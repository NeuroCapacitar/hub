import "server-only";
import { getPool } from "@/db";
import { deleteR2Objects } from "@/features/storage/r2";
import { lockLessonResourceLifecycle } from "./lesson-resource-lifecycle";

const CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_LIMIT = 100;

interface ExpiredLessonResourceUpload {
  object_key: string;
  preview_object_key: string | null;
  resource_id: string;
}

export const reconcileExpiredLessonResourceUploads = async ({
  now = new Date(),
  shouldContinue = async () => true,
}: {
  now?: Date;
  shouldContinue?: () => Promise<boolean>;
} = {}): Promise<number> => {
  const pool = getPool();
  const olderThan = new Date(now.getTime() - CLEANUP_GRACE_MS);
  const candidates = await pool.query<ExpiredLessonResourceUpload>(
    `
      select resource_id, object_key, preview_object_key
      from staged_lesson_resource_uploads
      where expires_at <= $1
        and status in ('prepared', 'uploaded', 'consumed', 'cleaning')
      order by expires_at asc
      limit $2
    `,
    [olderThan, CLEANUP_LIMIT]
  );

  let removed = 0;
  for (const candidate of candidates.rows) {
    if (!(await shouldContinue())) {
      break;
    }

    const client = await pool.connect();
    let objectKeys: string[] = [];
    try {
      await client.query("begin");
      await lockLessonResourceLifecycle(client);
      const claimed = await client.query<ExpiredLessonResourceUpload>(
        `update staged_lesson_resource_uploads
         set status = 'cleaning', updated_at = now()
         where resource_id = $1 and expires_at <= $2
           and status in ('prepared', 'uploaded', 'consumed', 'cleaning')
         returning resource_id, object_key, preview_object_key`,
        [candidate.resource_id, olderThan]
      );
      const current = claimed.rows[0];
      if (current) {
        objectKeys = [
          current.object_key,
          ...(current.preview_object_key ? [current.preview_object_key] : []),
        ];
        const referenceState = await client.query<{
          key: string;
          referenced: boolean;
        }>(
          `select candidate.key, exists (
             select 1 from lessons
             where content_json @> jsonb_build_object(
               'resources', jsonb_build_array(jsonb_build_object('key', candidate.key)))
             or content_json @> jsonb_build_object(
               'resources', jsonb_build_array(jsonb_build_object(
                 'preview', jsonb_build_object('key', candidate.key))))
           ) as referenced
           from unnest($1::text[]) as candidate(key)`,
          [objectKeys]
        );
        // Preserve the whole pair if either key is live; never tombstone a live preview.
        if (
          objectKeys.some(
            (key) =>
              !referenceState.rows.some(
                (state) => state.key === key && !state.referenced
              )
          )
        ) {
          await client.query(
            `update staged_lesson_resource_uploads
             set status = 'consumed', expires_at = $2, updated_at = now()
             where resource_id = $1 and status = 'cleaning'`,
            [candidate.resource_id, now]
          );
          objectKeys = [];
        }
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    if (objectKeys.length === 0) {
      continue;
    }

    if (!(await shouldContinue())) {
      break;
    }
    try {
      await deleteR2Objects(objectKeys);
    } catch {
      continue;
    }

    const deleted = await pool.query(
      `
          update staged_lesson_resource_uploads
          set status = 'deleted', updated_at = now()
          where resource_id = $1
            and expires_at <= $2
            and status = 'cleaning'
        `,
      [candidate.resource_id, olderThan]
    );
    removed += Number(deleted.rowCount);
  }

  return removed;
};
