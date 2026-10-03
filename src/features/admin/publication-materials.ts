import "server-only";
import { randomUUID } from "node:crypto";
import {
  type LessonResource,
  parseLessonContent,
} from "@/features/courses/lesson-content";
import { registerLessonResourcePublicationCopy } from "@/features/storage/lesson-resource-upload-registry";
import {
  buildPublishedLessonResource,
  isPublishedLessonResourceKey,
} from "@/features/storage/published-lesson-resource";
import { copyLessonResourceForPublication } from "@/features/storage/r2";

export interface PublicationLessonMaterial {
  contentJson: unknown;
  lessonId: string;
}

export const preparePublicationLessonMaterials = async ({
  actorUserId,
  materials,
}: {
  actorUserId: string;
  materials: readonly PublicationLessonMaterial[];
}): Promise<PublicationLessonMaterial[]> => {
  const prepared: PublicationLessonMaterial[] = [];
  for (const material of materials) {
    const content = parseLessonContent(material.contentJson);
    if (!content?.resources?.some((resource) => resource.storage === "r2")) {
      prepared.push(material);
      continue;
    }
    const resources: LessonResource[] = [];
    for (const resource of content.resources ?? []) {
      if (
        resource.storage !== "r2" ||
        (isPublishedLessonResourceKey(resource.key) &&
          (!resource.preview ||
            isPublishedLessonResourceKey(resource.preview.key)))
      ) {
        resources.push(resource);
        continue;
      }
      const destination = buildPublishedLessonResource({
        lessonId: material.lessonId,
        nonce: randomUUID(),
        resource,
      });
      await registerLessonResourcePublicationCopy({
        actorUserId,
        lessonId: material.lessonId,
        reference: { ...destination, id: `publication-${randomUUID()}` },
        source: resource,
      });
      await copyLessonResourceForPublication({ destination, resource });
      resources.push(destination);
    }
    prepared.push({
      contentJson: { ...content, resources },
      lessonId: material.lessonId,
    });
  }
  return prepared;
};
