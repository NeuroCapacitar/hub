import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";

const databaseUrl =
  process.env.INTEGRATION_DATABASE_URL?.trim() ||
  process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "INTEGRATION_DATABASE_URL is required for integration tests."
  );
}

const pool = new Pool({
  application_name: "hub-comment-discussion-continuity-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 4,
});
const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
}));
dependencies.getPool.mockReturnValue(pool);

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import { createLessonComment, getLessonComments } from "./server";

afterAll(async () => {
  await pool.end();
});

describe("lesson discussion continuity PostgreSQL behavior", () => {
  it("shares comments across publications and preserves them after source deletion", async () => {
    const courseId = randomUUID();
    const publishedPublicationId = randomUUID();
    const draftPublicationId = randomUUID();
    const publishedModuleId = randomUUID();
    const draftModuleId = randomUUID();
    const publishedLessonId = randomUUID();
    const draftLessonId = randomUUID();
    const newIdentityLessonId = randomUUID();
    const curriculumKey = randomUUID();
    const newCurriculumKey = randomUUID();
    const adminUserId = `comment-admin-${randomUUID()}`;
    const studentUserId = `comment-student-${randomUUID()}`;
    const now = new Date();

    await pool.query(
      "insert into users (id, name, email, email_verified) values ($1, 'Comment admin', $2, true), ($3, 'Comment student', $4, true)",
      [
        adminUserId,
        `${adminUserId}@example.test`,
        studentUserId,
        `${studentUserId}@example.test`,
      ]
    );
    await pool.query(
      "insert into courses (id, slug, title, status, catalog_visibility, sales_status) values ($1, $2, 'Discussion continuity course', 'active', 'hidden', 'closed')",
      [courseId, `discussion-continuity-${randomUUID()}`]
    );
    await pool.query(
      "insert into course_publications (id, course_id, publication_number, status, title_snapshot, published_at) values ($1, $3, 2, 'published', 'Discussion continuity course', $4), ($2, $3, 3, 'draft', 'Discussion continuity course', null)",
      [publishedPublicationId, draftPublicationId, courseId, now]
    );
    await pool.query(
      "insert into modules (id, course_id, course_publication_id, title, sort_order, status) values ($1, $3, $4, 'Published module', 1, 'active'), ($2, $3, $5, 'Draft module', 1, 'active')",
      [
        publishedModuleId,
        draftModuleId,
        courseId,
        publishedPublicationId,
        draftPublicationId,
      ]
    );
    await pool.query(
      "insert into lessons (id, module_id, course_publication_id, curriculum_key, title, duration_seconds, video_duration_seconds, text_duration_seconds, text_word_count, sort_order, status, is_published, is_required) values ($1, $4, $6, $8, 'Published lesson', 0, 0, 0, 0, 1, 'active', true, true), ($2, $5, $7, $8, 'Draft lesson', 0, 0, 0, 0, 1, 'draft', false, true), ($3, $5, $7, $9, 'New identity lesson', 0, 0, 0, 0, 2, 'draft', false, true)",
      [
        publishedLessonId,
        draftLessonId,
        newIdentityLessonId,
        publishedModuleId,
        draftModuleId,
        publishedPublicationId,
        draftPublicationId,
        curriculumKey,
        newCurriculumKey,
      ]
    );
    await pool.query(
      "insert into lesson_comments (source_lesson_id, course_id, curriculum_key, author_user_id, body) values ($1, $2, $3, $4, 'Pergunta da aluna')",
      [publishedLessonId, courseId, curriculumKey, studentUserId]
    );
    const root = await pool.query(
      "select id from lesson_comments where source_lesson_id = $1 limit 1",
      [publishedLessonId]
    );
    const rootId = root.rows[0]?.id;
    if (!rootId) {
      throw new Error("Failed to create integration root comment.");
    }

    try {
      const reply = await createLessonComment({
        body: "Resposta da equipe",
        lessonId: draftLessonId,
        parentId: rootId,
        role: "admin",
        userId: adminUserId,
      });
      expect(reply.courseId).toBe(courseId);

      const currentDiscussion = await getLessonComments({
        lessonId: draftLessonId,
        role: "admin",
        userId: adminUserId,
      });
      expect(currentDiscussion.comments[0]?.id).toBe(rootId);
      expect(currentDiscussion.comments[0]?.replies).toHaveLength(1);

      const newDiscussion = await getLessonComments({
        lessonId: newIdentityLessonId,
        role: "admin",
        userId: adminUserId,
      });
      expect(newDiscussion.comments).toHaveLength(0);

      await pool.query("delete from lessons where id = $1", [
        publishedLessonId,
      ]);

      const afterSourceDeletion = await getLessonComments({
        lessonId: draftLessonId,
        role: "admin",
        userId: adminUserId,
      });
      expect(afterSourceDeletion.comments[0]?.id).toBe(rootId);
      expect(afterSourceDeletion.comments[0]?.replies).toHaveLength(1);

      const source = await pool.query(
        "select source_lesson_id from lesson_comments where id = $1",
        [rootId]
      );
      expect(source.rows[0]?.source_lesson_id).toBeNull();
    } finally {
      await pool.query("delete from audit_logs where actor_user_id = $1", [
        adminUserId,
      ]);
      await pool.query("delete from courses where id = $1", [courseId]);
      await pool.query("delete from users where id in ($1, $2)", [
        adminUserId,
        studentUserId,
      ]);
    }
  });
});
