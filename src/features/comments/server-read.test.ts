import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, connect } = vi.hoisted(() => ({
  client: {
    query: vi.fn(),
    release: vi.fn(),
  },
  connect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ connect }),
}));
vi.mock("@/features/admin/audit-log", () => ({
  writeAuditLog: vi.fn(),
}));
vi.mock("@/features/enrollments/access", () => ({
  resolveLessonAccess: vi.fn(),
  resolveLessonAccessWithClient: vi.fn(),
}));
vi.mock("@/features/enrollments/enrollment-aggregate-lock", () => ({
  lockEnrollmentAggregate: vi.fn(),
}));
vi.mock("@/features/courses/content-release-observability", () => ({
  createContentReleaseDiagnostics: () => ({ report: vi.fn() }),
}));

import { getLessonComments } from "./server";

beforeEach(() => {
  connect.mockResolvedValue(client);
  client.release.mockReset();
  client.query.mockReset();
});

describe("lesson comment discussion reads", () => {
  it("keeps staff replies created in draft in the same logical discussion", async () => {
    client.query.mockImplementation((sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }

      if (sql.includes("select m.course_id, l.curriculum_key")) {
        return {
          rows: [{ course_id: "course-1", curriculum_key: "curriculum-1" }],
        };
      }

      if (sql.includes("from lesson_comments lc")) {
        return {
          rows: [
            {
              author_id: "student-1",
              author_name: "Student",
              author_role: "student",
              body: "Pergunta original",
              created_at: new Date("2026-09-19T12:00:00.000Z"),
              id: "root-1",
              source_lesson_id: "lesson-published",
              parent_id: null,
              status: "visible",
              updated_at: new Date("2026-09-19T12:00:00.000Z"),
            },
            {
              author_id: "admin-1",
              author_name: "Admin",
              author_role: "admin",
              body: "Resposta da equipe",
              created_at: new Date("2026-09-19T12:01:00.000Z"),
              id: "reply-1",
              source_lesson_id: "lesson-draft",
              parent_id: "root-1",
              status: "visible",
              updated_at: new Date("2026-09-19T12:01:00.000Z"),
            },
          ],
        };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await getLessonComments({
      lessonId: "lesson-draft",
      role: "admin",
      userId: "admin-1",
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.replies).toHaveLength(1);
    expect(result.comments[0]?.replies[0]?.author.role).toBe("admin");
    const commentsQuery = client.query.mock.calls.find(([sql]) =>
      String(sql).includes("from lesson_comments lc")
    );
    expect(commentsQuery?.[1]).toEqual(["course-1", "curriculum-1", true]);
    expect(String(commentsQuery?.[0])).toContain("lc.course_id = $1");
    expect(String(commentsQuery?.[0])).toContain("lc.curriculum_key = $2");
  });
});
