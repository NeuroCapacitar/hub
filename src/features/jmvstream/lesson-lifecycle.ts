import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { lockCourseContentRelease } from "@/features/courses/content-release-lock";
import { lockJmvstreamVideoLifecycle } from "./asset-lifecycle";

export const withJmvstreamLessonDraft = async <Result>({
  courseId,
  lessonId,
  operation,
}: {
  courseId: string;
  lessonId: string;
  operation: (client: PoolClient) => Promise<Result>;
}): Promise<Result> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await lockJmvstreamVideoLifecycle(client);
    await lockCourseContentRelease(client, courseId);
    const lesson = await client.query<{ id: string }>(
      `select l.id from lessons l
       join modules m on m.id = l.module_id
       join course_publications cp on cp.id = l.course_publication_id
       where l.id = $1 and m.course_id = $2 and cp.status = 'draft'
       for update of l`,
      [lessonId, courseId]
    );
    if (!lesson.rows[0]) {
      throw new Error("A Aula deixou de pertencer a um rascunho editavel.");
    }
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
