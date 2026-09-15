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
  application_name: "hub-publication-continuity-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 8,
});
const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
}));
dependencies.getPool.mockReturnValue(pool);

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import {
  getStudentLessonWorkspace,
  recordLessonWatchProgress,
  startLessonWatchSession,
} from "./server";

afterAll(async () => {
  await pool.end();
});

describe("publication continuity PostgreSQL behavior", () => {
  it("preserves compatible watch state and rejects an old session after a new one starts", async () => {
    const courseId = randomUUID();
    const firstPublicationId = randomUUID();
    const secondPublicationId = randomUUID();
    const firstModuleId = randomUUID();
    const secondModuleId = randomUUID();
    const firstLessonId = randomUUID();
    const secondLessonId = randomUUID();
    const curriculumKey = randomUUID();
    const userId = `publication-continuity-${randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 86_400_000);

    await pool.query(
      `insert into users (id, name, email, email_verified)
       values ($1, 'Continuity student', $2, true)`,
      [userId, `${userId}@example.test`]
    );
    await pool.query(
      `insert into courses (
         id, slug, title, status, catalog_visibility, sales_status
       ) values ($1, $2, 'Continuity course', 'active', 'hidden', 'closed')`,
      [courseId, `continuity-${randomUUID()}`]
    );
    await pool.query(
      `insert into course_publications (
         id, course_id, publication_number, status, title_snapshot, published_at
       ) values
         ($1, $3, 1, 'retired', 'Continuity course', $5::timestamptz),
         ($2, $3, 2, 'published', 'Continuity course', $4::timestamptz)`,
      [firstPublicationId, secondPublicationId, courseId, now, now]
    );
    await pool.query(
      `insert into modules (
         id, course_id, course_publication_id, title, sort_order, status
       ) values
         ($1, $3, $4, 'First module', 1, 'active'),
         ($2, $3, $5, 'Second module', 1, 'active')`,
      [
        firstModuleId,
        secondModuleId,
        courseId,
        firstPublicationId,
        secondPublicationId,
      ]
    );
    await pool.query(
      `insert into lessons (
         id,
         module_id,
         course_publication_id,
         curriculum_key,
         title,
         video_provider,
         video_external_id,
         video_embed_url,
         duration_seconds,
         video_duration_seconds,
         sort_order,
         status,
         is_published,
         is_required
       ) values
         ($1, $3, $5, $7, 'First lesson', 'jmvstream', 'video-shared', 'https://player.jmvstream.com/video-shared', 120, 120, 1, 'active', true, true),
         ($2, $4, $6, $7, 'Second lesson', 'jmvstream', 'video-shared', 'https://player.jmvstream.com/video-shared', 120, 120, 1, 'active', true, true)`,
      [
        firstLessonId,
        secondLessonId,
        firstModuleId,
        secondModuleId,
        firstPublicationId,
        secondPublicationId,
        curriculumKey,
      ]
    );
    await pool.query(
      `insert into enrollments (
         user_id,
         course_id,
         status,
         content_release_mode,
         starts_at,
         expires_at
       ) values ($1, $2, 'active', 'full_access', $3, $4)`,
      [userId, courseId, new Date(now.getTime() - 86_400_000), expiresAt]
    );
    await pool.query(
      `insert into lesson_watch_progress (
         user_id,
         lesson_id,
         current_seconds,
         resume_position_seconds,
         max_position_seconds,
         validated_position_seconds,
         playing_time_seconds,
         duration_seconds,
         watched_percent,
         last_event_name,
         tracking_session_id,
         last_event_sequence,
         tracking_version
       ) values ($1, $2, 60, 60, 60, 60, 30, 120, 50, 'jmvplayerout-status', 'old-session', 4, 1)`,
      [userId, firstLessonId]
    );

    try {
      const beforeSession = await getStudentLessonWorkspace({
        lessonId: secondLessonId,
        viewer: { role: "student", userId },
      });
      expect(beforeSession).toMatchObject({
        data: {
          lesson: {
            id: secondLessonId,
            watchProgress: {
              isLinearProgressBlocked: false,
              resumePositionSeconds: 60,
              watchedPercent: 50,
            },
          },
        },
        kind: "available",
      });

      const session = await startLessonWatchSession({
        lessonId: secondLessonId,
        userId,
      });
      expect(session).toMatchObject({
        isLinearProgressBlocked: false,
        resumePositionSeconds: 60,
        watchedPercent: 50,
      });

      await expect(
        recordLessonWatchProgress({
          currentSeconds: 55,
          durationSeconds: 120,
          eventName: "jmvplayerout-status",
          eventSequence: 5,
          isPaused: false,
          lessonId: secondLessonId,
          trackingSessionId: "old-session",
          userId,
        })
      ).resolves.toMatchObject({
        trackingSessionActive: false,
        watchedPercent: 50,
      });

      await expect(
        recordLessonWatchProgress({
          currentSeconds: 65,
          durationSeconds: 120,
          eventName: "jmvplayerout-status",
          eventSequence: 1,
          isPaused: false,
          lessonId: secondLessonId,
          trackingSessionId: session.trackingSessionId,
          userId,
        })
      ).resolves.toMatchObject({
        trackingSessionActive: true,
        watchedPercent: 54,
      });

      const current = await pool.query<{
        current_seconds: number;
        lesson_id: string;
        resume_position_seconds: number;
        tracking_session_id: string;
        validated_position_seconds: number;
      }>(
        `select lesson_id, current_seconds, resume_position_seconds,
                validated_position_seconds, tracking_session_id
         from lesson_watch_progress
         where user_id = $1 and lesson_id = $2`,
        [userId, secondLessonId]
      );
      expect(current.rows[0]).toMatchObject({
        current_seconds: 65,
        lesson_id: secondLessonId,
        resume_position_seconds: 65,
        tracking_session_id: session.trackingSessionId,
        validated_position_seconds: 65,
      });
    } finally {
      await pool.query("delete from courses where id = $1", [courseId]);
      await pool.query("delete from users where id = $1", [userId]);
    }
  });
});
