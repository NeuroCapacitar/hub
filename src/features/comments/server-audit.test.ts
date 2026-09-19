import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, connect, writeAuditLog } = vi.hoisted(() => ({
  client: {
    query: vi.fn(),
    release: vi.fn(),
  },
  connect: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ connect }),
}));
vi.mock("@/features/admin/audit-log", () => ({ writeAuditLog }));
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

import {
  createLessonComment,
  hideLessonComment,
  restoreLessonComment,
} from "./server";

beforeEach(() => {
  connect.mockResolvedValue(client);
  writeAuditLog.mockReset();
  client.release.mockReset();
  client.query.mockReset();
  client.query.mockImplementation((sql: string) => {
    if (sql.includes("insert into lesson_comments")) {
      return { rows: [{ id: "comment-1" }] };
    }
    if (sql.includes("update lesson_comments")) {
      return {
        rows: [{ course_id: "course-1", source_lesson_id: "lesson-1" }],
      };
    }
    if (sql.includes("from lesson_comments")) {
      return {
        rows: [
          {
            course_id: "course-1",
            curriculum_key: "curriculum-1",
            id: "parent-1",
            source_lesson_id: "lesson-1",
            parent_id: null,
            status: "visible",
          },
        ],
      };
    }
    if (sql.includes("from lessons l")) {
      return {
        rows: [{ course_id: "course-1", curriculum_key: "curriculum-1" }],
      };
    }
    return { rows: [] };
  });
});

describe("lesson comment audit trail", () => {
  it("audits Support comments without storing the body", async () => {
    await createLessonComment({
      body: "Uma dúvida sobre a aula",
      lessonId: "lesson-1",
      parentId: "parent-1",
      role: "support",
      userId: "support-1",
    });

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "lesson_comment.created",
        actorUserId: "support-1",
        metadata: {
          courseId: "course-1",
          curriculumKey: "curriculum-1",
          lessonId: "lesson-1",
          parentId: "parent-1",
        },
        targetId: "comment-1",
        targetType: "lesson_comment",
      })
    );
    const insertCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes("insert into lesson_comments")
    );
    expect(String(insertCall?.[0])).toContain("course_id");
    expect(String(insertCall?.[0])).toContain("curriculum_key");
    expect(insertCall?.[1]).toEqual([
      "lesson-1",
      "course-1",
      "curriculum-1",
      "support-1",
      "parent-1",
      "Uma dúvida sobre a aula",
    ]);
    expect(JSON.stringify(writeAuditLog.mock.calls[0])).not.toContain(
      "Uma dúvida sobre a aula"
    );
  });

  it("audits hiding and restoring in the same service boundary", async () => {
    await hideLessonComment({
      actorUserId: "admin-1",
      commentId: "comment-1",
    });
    await restoreLessonComment({
      actorUserId: "support-1",
      commentId: "comment-1",
    });

    expect(writeAuditLog).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "lesson_comment.hidden",
        actorUserId: "admin-1",
        targetId: "comment-1",
      })
    );
    expect(writeAuditLog).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "lesson_comment.restored",
        actorUserId: "support-1",
        targetId: "comment-1",
      })
    );
    expect(
      client.query.mock.calls.filter(([sql]) => sql === "BEGIN")
    ).toHaveLength(2);
    expect(
      client.query.mock.calls.filter(([sql]) => sql === "COMMIT")
    ).toHaveLength(2);
  });
});
