import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { createContentReleaseDiagnostics } from "@/features/courses/content-release-observability";
import {
  resolveLessonAccess,
  resolveLessonAccessWithClient,
} from "@/features/enrollments/access";
import { lockEnrollmentAggregate } from "@/features/enrollments/enrollment-aggregate-lock";
import type { AppRole } from "@/lib/session";
import {
  buildLessonCommentTree,
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
  lesson_id: string;
  parent_id: string | null;
  status: "hidden" | "visible";
  updated_at: Date;
}

interface ParentCommentRow {
  course_id: string;
  curriculum_key: string;
  id: string;
  lesson_id: string;
  parent_id: string | null;
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
  if (role === "support") {
    throw new Error("Acesso ao conteúdo não permitido para suporte.");
  }

  if (role === "admin") {
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
    const canModerateComments = role === "admin";
    const { rows } = await client.query<LessonCommentRow>(
      `
        select
          lc.id,
          lc.lesson_id,
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
        where exists (
          select 1
            from lessons comment_lesson
            join modules comment_module on comment_module.id = comment_lesson.module_id
            join course_publications comment_publication
              on comment_publication.id = comment_lesson.course_publication_id
            where comment_lesson.id = lc.lesson_id
              and comment_module.course_id = $1
              and comment_lesson.curriculum_key = $2
              and comment_publication.status in ('published', 'retired')
          )
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

    if (role === "support") {
      throw new Error("Acesso ao conteúdo não permitido para suporte.");
    }

    if (role !== "admin") {
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
          lessonId: parent.lesson_id,
          parentId: parent.parent_id,
        },
      });
    }

    const { rows } = await client.query<{ id: string }>(
      `
        insert into lesson_comments (
          lesson_id,
          author_user_id,
          parent_id,
          body
        )
        values ($1, $2, $3, $4)
        returning id
      `,
      [lessonId, userId, parentId ?? null, normalizedBody]
    );
    const commentId = rows[0]?.id;

    if (!commentId) {
      throw new Error("Nao foi possivel salvar o comentario.");
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
}): Promise<{ courseId: string; lessonId: string }> => {
  const { rows } = await getPool().query<{
    course_id: string;
    lesson_id: string;
  }>(
    `
      update lesson_comments lc
      set status = 'hidden',
          hidden_by_user_id = $2,
          hidden_at = now(),
          updated_at = now()
      from lessons l
      join modules m on m.id = l.module_id
      where lc.id = $1
        and l.id = lc.lesson_id
      returning l.id as lesson_id, m.course_id
    `,
    [commentId, actorUserId]
  );
  const result = rows[0];

  if (!result) {
    throw new Error("Comentario invalido.");
  }

  return {
    courseId: result.course_id,
    lessonId: result.lesson_id,
  };
};

export const restoreLessonComment = async ({
  commentId,
}: {
  commentId: string;
}): Promise<{ courseId: string; lessonId: string }> => {
  const { rows } = await getPool().query<{
    course_id: string;
    lesson_id: string;
  }>(
    `
      update lesson_comments lc
      set status = 'visible',
          hidden_by_user_id = null,
          hidden_at = null,
          updated_at = now()
      from lessons l
      join modules m on m.id = l.module_id
      where lc.id = $1
        and l.id = lc.lesson_id
      returning l.id as lesson_id, m.course_id
    `,
    [commentId]
  );
  const result = rows[0];

  if (!result) {
    throw new Error("Comentario invalido.");
  }

  return {
    courseId: result.course_id,
    lessonId: result.lesson_id,
  };
};

const getParentComment = async (
  db: CommentDatabase,
  commentId: string
): Promise<ParentCommentRow | null> => {
  const { rows } = await db.query<ParentCommentRow>(
    `
      select lesson_comments.id,
             lesson_comments.lesson_id,
             lesson_comments.parent_id,
             lesson_comments.status,
             modules.course_id,
             lessons.curriculum_key
      from lesson_comments
      join lessons on lessons.id = lesson_comments.lesson_id
      join modules on modules.id = lessons.module_id
      join course_publications on course_publications.id = lessons.course_publication_id
      where lesson_comments.id = $1
        and course_publications.status in ('published', 'retired')
      limit 1
    `,
    [commentId]
  );

  return rows[0] ?? null;
};

const toLessonCommentRecord = (row: LessonCommentRow): LessonCommentRecord => ({
  id: row.id,
  lessonId: row.lesson_id,
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
