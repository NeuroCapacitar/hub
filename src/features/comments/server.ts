import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { writeAuditLog } from "@/features/admin/audit-log";
import { createContentReleaseDiagnostics } from "@/features/courses/content-release-observability";
import {
  resolveLessonAccess,
  resolveLessonAccessWithClient,
} from "@/features/enrollments/access";
import { lockEnrollmentAggregate } from "@/features/enrollments/enrollment-aggregate-lock";
import type { AppRole } from "@/lib/session";
import {
  buildLessonCommentTree,
  canParticipateInStaffDiscussion,
  isLessonCommentManager,
  type LessonCommentRecord,
  type LessonCommentView,
  type LessonDiscussionIdentity,
  normalizeCommentBody,
  validateReplyTarget,
} from "./rules";

interface LessonAccessResult {
  courseId: string;
  discussion: LessonDiscussionIdentity;
}

interface LessonCommentRow {
  author_id: string | null;
  author_name: string | null;
  author_role: AppRole | null;
  body: string;
  created_at: Date;
  id: string;
  parent_id: string | null;
  source_lesson_id: string | null;
  status: "hidden" | "visible";
  updated_at: Date;
}

interface ParentCommentRow {
  course_id: string;
  curriculum_key: string;
  id: string;
  parent_id: string | null;
  source_lesson_id: string | null;
  status: "hidden" | "visible";
}

type CommentDatabase = Pick<PoolClient, "query">;

export interface LessonCommentsData {
  comments: LessonCommentView[];
  courseId: string;
  totalCount: number;
}

export const ensureCanCommentOnLesson = async ({
  client,
  lessonId,
  role,
  userId,
}: {
  client?: PoolClient;
  lessonId: string;
  role: AppRole;
  userId: string;
}): Promise<LessonAccessResult> => {
  if (canParticipateInStaffDiscussion(role)) {
    const db = client ?? getPool();
    const { rows } = await db.query<{
      course_id: string;
      curriculum_key: string;
    }>(
      `
        select m.course_id, l.curriculum_key
        from lessons l
        join modules m on m.id = l.module_id
        where l.id = $1
        limit 1
      `,
      [lessonId]
    );
    const courseId = rows[0]?.course_id;
    const curriculumKey = rows[0]?.curriculum_key;

    if (!(courseId && curriculumKey)) {
      throw new Error("Aula invalida.");
    }

    return {
      courseId,
      discussion: { courseId, curriculumKey },
    };
  }

  const db = client ?? getPool();
  const lesson = await db.query<{
    course_id: string;
    curriculum_key: string;
  }>(
    `
      select m.course_id, l.curriculum_key
      from lessons l
      join modules m on m.id = l.module_id
      where l.id = $1
      limit 1
    `,
    [lessonId]
  );
  const courseId = lesson.rows[0]?.course_id;
  const curriculumKey = lesson.rows[0]?.curriculum_key;
  if (!(courseId && curriculumKey)) {
    throw new Error("Aula invalida.");
  }
  if (client) {
    await lockEnrollmentAggregate(client, userId, courseId);
  }

  const access = await resolveLessonAccess({
    client,
    diagnostics: createContentReleaseDiagnostics(),
    lessonId,
    userId,
  });
  if (access.kind !== "allowed") {
    throw new Error("Aula indisponivel para esta matricula.");
  }
  return {
    courseId: access.courseId,
    discussion: { courseId: access.courseId, curriculumKey },
  };
};

export const getLessonComments = async ({
  lessonId,
  role,
  userId,
}: {
  lessonId: string;
  role: AppRole;
  userId: string;
}): Promise<LessonCommentsData> => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { courseId, discussion } = await ensureCanCommentOnLesson({
      client,
      lessonId,
      role,
      userId,
    });
    const canModerateComments = isLessonCommentManager(role);
    const { rows } = await client.query<LessonCommentRow>(
      `
        select
          lc.id,
          lc.source_lesson_id,
          lc.parent_id,
          lc.body,
          lc.status,
          lc.created_at,
          lc.updated_at,
          u.id as author_id,
          u.name as author_name,
          coalesce(p.role, 'student') as author_role
        from lesson_comments lc
        left join users u on u.id = lc.author_user_id
        left join profiles p on p.user_id = u.id
        where lc.course_id = $1
          and lc.curriculum_key = $2
          and (
            $3::boolean
            or (
              lc.status = 'visible'
              and (
                lc.parent_id is null
                or exists (
                  select 1
                  from lesson_comments parent
                  where parent.id = lc.parent_id
                    and parent.status = 'visible'
                )
              )
            )
          )
        order by lc.created_at asc, lc.id asc
      `,
      [courseId, discussion.curriculumKey, canModerateComments]
    );

    const records = rows.map(toLessonCommentRecord);
    await client.query("COMMIT");

    return {
      comments: buildLessonCommentTree(records),
      courseId,
      totalCount: records.length,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original authorization or query error.
    }
    throw error;
  } finally {
    client.release();
  }
};

export const createLessonComment = async ({
  body,
  lessonId,
  parentId,
  role,
  userId,
}: {
  body: string;
  lessonId: string;
  parentId?: null | string;
  role: AppRole;
  userId: string;
}): Promise<{ commentId: string; courseId: string }> => {
  const normalizedBody = normalizeCommentBody(body);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const lesson = await client.query<{
      course_id: string;
      curriculum_key: string;
    }>(
      `
        select m.course_id, l.curriculum_key
        from lessons l
        join modules m on m.id = l.module_id
        where l.id = $1
        limit 1
      `,
      [lessonId]
    );
    const courseId = lesson.rows[0]?.course_id;
    const curriculumKey = lesson.rows[0]?.curriculum_key;

    if (!(courseId && curriculumKey)) {
      throw new Error("Aula invalida.");
    }

    if (!canParticipateInStaffDiscussion(role)) {
      await lockEnrollmentAggregate(client, userId, courseId);
      const access = await resolveLessonAccessWithClient({
        client,
        diagnostics: createContentReleaseDiagnostics(),
        lessonId,
        userId,
      });
      if (access.kind !== "allowed") {
        throw new Error("Aula indisponivel para esta matricula.");
      }
    }

    if (parentId) {
      const parent = await getParentComment(client, parentId);

      if (!parent || parent.status === "hidden") {
        throw new Error("Comentario de origem invalido.");
      }

      validateReplyTarget({
        discussion: { courseId, curriculumKey },
        lessonId,
        parent: {
          discussion: {
            courseId: parent.course_id,
            curriculumKey: parent.curriculum_key,
          },
          id: parent.id,
          lessonId: parent.source_lesson_id,
          parentId: parent.parent_id,
        },
      });
    }

    const { rows } = await client.query<{ id: string }>(
      `
        insert into lesson_comments (
          source_lesson_id,
          course_id,
          curriculum_key,
          author_user_id,
          parent_id,
          body
        )
        values ($1, $2, $3, $4, $5, $6)
        returning id
      `,
      [
        lessonId,
        courseId,
        curriculumKey,
        userId,
        parentId ?? null,
        normalizedBody,
      ]
    );
    const commentId = rows[0]?.id;

    if (!commentId) {
      throw new Error("Nao foi possivel salvar o comentario.");
    }

    if (canParticipateInStaffDiscussion(role)) {
      await writeAuditLog({
        action: "lesson_comment.created",
        actorUserId: userId,
        client,
        metadata: {
          courseId,
          curriculumKey,
          lessonId,
          parentId: parentId ?? null,
        },
        targetId: commentId,
        targetType: "lesson_comment",
      });
    }

    await client.query("COMMIT");
    return { commentId, courseId };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original authorization or query error.
    }
    throw error;
  } finally {
    client.release();
  }
};

export const hideLessonComment = async ({
  actorUserId,
  commentId,
}: {
  actorUserId: string;
  commentId: string;
}): Promise<{ courseId: string; lessonId: string | null }> => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      course_id: string;
      curriculum_key: string;
      source_lesson_id: string | null;
    }>(
      `
        update lesson_comments lc
        set status = 'hidden',
            hidden_by_user_id = $2,
            hidden_at = now(),
            updated_at = now()
        where lc.id = $1
        returning lc.source_lesson_id, lc.course_id, lc.curriculum_key
      `,
      [commentId, actorUserId]
    );
    const result = rows[0];

    if (!result) {
      throw new Error("Comentario invalido.");
    }

    await writeAuditLog({
      action: "lesson_comment.hidden",
      actorUserId,
      client,
      metadata: {
        courseId: result.course_id,
        curriculumKey: result.curriculum_key,
        lessonId: result.source_lesson_id,
        status: "hidden",
      },
      targetId: commentId,
      targetType: "lesson_comment",
    });

    await client.query("COMMIT");
    return {
      courseId: result.course_id,
      lessonId: result.source_lesson_id,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
};

export const restoreLessonComment = async ({
  actorUserId,
  commentId,
}: {
  actorUserId: string;
  commentId: string;
}): Promise<{ courseId: string; lessonId: string | null }> => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      course_id: string;
      curriculum_key: string;
      source_lesson_id: string | null;
    }>(
      `
        update lesson_comments lc
        set status = 'visible',
            hidden_by_user_id = null,
            hidden_at = null,
            updated_at = now()
        where lc.id = $1
        returning lc.source_lesson_id, lc.course_id, lc.curriculum_key
      `,
      [commentId]
    );
    const result = rows[0];

    if (!result) {
      throw new Error("Comentario invalido.");
    }

    await writeAuditLog({
      action: "lesson_comment.restored",
      actorUserId,
      client,
      metadata: {
        courseId: result.course_id,
        curriculumKey: result.curriculum_key,
        lessonId: result.source_lesson_id,
        status: "visible",
      },
      targetId: commentId,
      targetType: "lesson_comment",
    });

    await client.query("COMMIT");
    return {
      courseId: result.course_id,
      lessonId: result.source_lesson_id,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
};

const getParentComment = async (
  db: CommentDatabase,
  commentId: string
): Promise<ParentCommentRow | null> => {
  const { rows } = await db.query<ParentCommentRow>(
    `
      select lesson_comments.id,
             lesson_comments.source_lesson_id,
             lesson_comments.parent_id,
             lesson_comments.status,
             lesson_comments.course_id,
             lesson_comments.curriculum_key
      from lesson_comments
      where lesson_comments.id = $1
      limit 1
    `,
    [commentId]
  );

  return rows[0] ?? null;
};

const toLessonCommentRecord = (row: LessonCommentRow): LessonCommentRecord => ({
  id: row.id,
  lessonId: row.source_lesson_id,
  parentId: row.parent_id,
  body: row.body,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: {
    id: row.author_id ?? "deleted-user",
    name: row.author_name ?? "Usuario removido",
    role: row.author_role ?? "student",
  },
});
