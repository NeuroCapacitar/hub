import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { resolveLessonAccessWithClient } from "@/features/enrollments/access";
import { lockEnrollmentAggregate } from "@/features/enrollments/enrollment-aggregate-lock";

export class LessonAccessDeniedError extends Error {
  constructor() {
    super("Aula indisponivel para esta matricula.");
    this.name = "LessonAccessDeniedError";
  }
}

export const assertProtectedLessonAccess = async ({
  courseId,
  lessonId,
  userId,
}: {
  courseId: string;
  lessonId: string;
  userId: string;
}): Promise<void> => {
  const client: PoolClient = await getPool().connect();

  try {
    await client.query("begin");
    await lockEnrollmentAggregate(client, userId, courseId);
    const access = await resolveLessonAccessWithClient({
      client,
      lessonId,
      userId,
    });
    if (access?.kind !== "allowed") {
      throw new LessonAccessDeniedError();
    }
    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the authorization failure if rollback itself is unavailable.
    }
    throw error;
  } finally {
    client.release();
  }
};

export const assertAdminPreviewLessonAccess = async ({
  lessonId,
}: {
  lessonId: string;
}): Promise<void> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select l.id
      from lessons l
      join modules m
        on m.id = l.module_id
       and m.course_publication_id = l.course_publication_id
      join course_publications cp on cp.id = l.course_publication_id
      where l.id = $1
      limit 1
    `,
    [lessonId]
  );

  if (!rows[0]) {
    throw new LessonAccessDeniedError();
  }
};
