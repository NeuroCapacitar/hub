import "server-only";
import { randomUUID } from "node:crypto";
import { parseLessonContent } from "@/features/courses/lesson-content";
import type { LessonResourceUploadReference } from "./lesson-resource-upload";
import type { LessonResourceUploadQueryable } from "./lesson-resource-upload-registry";

interface ResourceQueryClient {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
}

export const lockLessonResourceLifecycle = async (
  queryable: LessonResourceUploadQueryable
): Promise<void> => {
  await queryable.query(
    "select pg_advisory_xact_lock(hashtext('lesson-resource-lifecycle'))"
  );
};

export const getLessonR2Resources = (
  contentJson: unknown
): LessonResourceUploadReference[] => {
  const content = parseLessonContent(contentJson);
  return content?.type === "text"
    ? (content.resources ?? []).filter(
        (resource): resource is LessonResourceUploadReference =>
          resource.storage === "r2"
      )
    : [];
};

export const assertLessonResourcesAvailable = async ({
  queryable,
  resources,
}: {
  queryable: ResourceQueryClient;
  resources: readonly LessonResourceUploadReference[];
}): Promise<void> => {
  const keys = resources.flatMap((resource) => [
    resource.key,
    ...(resource.preview ? [resource.preview.key] : []),
  ]);
  if (keys.length === 0) {
    return;
  }
  const result = await queryable.query(
    `select resource_id from staged_lesson_resource_uploads
     where status in ('cleaning', 'deleted')
       and (object_key = any($1::text[]) or preview_object_key = any($1::text[]))
     limit 1`,
    [keys]
  );
  if (result.rows.length > 0) {
    throw new Error(
      "O material foi removido ou esta em limpeza. Envie-o novamente."
    );
  }
};

export const queueRemovedLessonResources = async ({
  actorUserId,
  lessonId,
  nextResources,
  previousResources,
  queryable,
}: {
  actorUserId: string;
  lessonId: string;
  nextResources: readonly LessonResourceUploadReference[];
  previousResources: readonly LessonResourceUploadReference[];
  queryable: LessonResourceUploadQueryable;
}): Promise<void> => {
  const nextKeys = new Set(nextResources.map((resource) => resource.key));
  for (const resource of previousResources) {
    if (nextKeys.has(resource.key)) {
      continue;
    }
    await queryable.query(
      `insert into staged_lesson_resource_uploads (
         resource_id, object_key, preview_object_key, lesson_id, actor_user_id,
         content_type, file_name, size_bytes, preview_content_type,
         preview_size_bytes, preview_width, preview_height, status, expires_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'consumed', now())
       on conflict (object_key) do update set
         expires_at = greatest(staged_lesson_resource_uploads.expires_at, now()),
         updated_at = now()`,
      [
        `removed-resource-${randomUUID()}`,
        resource.key,
        resource.preview?.key ?? null,
        lessonId,
        actorUserId,
        resource.contentType,
        resource.fileName,
        resource.sizeBytes,
        resource.preview?.contentType ?? null,
        resource.preview?.sizeBytes ?? null,
        resource.preview?.width ?? null,
        resource.preview?.height ?? null,
      ]
    );
  }
};
