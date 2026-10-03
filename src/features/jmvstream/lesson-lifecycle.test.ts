import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, release, operation } = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  operation: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ connect: async () => ({ query, release }) }),
}));

import { withJmvstreamLessonDraft } from "./lesson-lifecycle";

describe("JMVStream final publication decision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
    operation.mockResolvedValue("linked");
  });

  it("rejects completion when publication advanced while the provider was processing", async () => {
    await expect(
      withJmvstreamLessonDraft({
        courseId: "course-1",
        lessonId: "lesson-1",
        operation,
      })
    ).rejects.toThrow("rascunho editavel");
    expect(operation).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith("rollback");
    expect(query).not.toHaveBeenCalledWith("commit");
    expect(release).toHaveBeenCalledOnce();
  });

  it("commits a valid draft mutation and releases the transaction", async () => {
    query.mockImplementation((sql: string) => ({
      rows: sql.includes("for update of l") ? [{ id: "lesson-1" }] : [],
    }));
    await expect(
      withJmvstreamLessonDraft({
        courseId: "course-1",
        lessonId: "lesson-1",
        operation,
      })
    ).resolves.toBe("linked");
    expect(operation).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith("commit");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back asset and lesson changes when the last mutation fails", async () => {
    query.mockImplementation((sql: string) => ({
      rows: sql.includes("for update of l") ? [{ id: "lesson-1" }] : [],
    }));
    operation.mockRejectedValue(new Error("session changed"));
    await expect(
      withJmvstreamLessonDraft({
        courseId: "course-1",
        lessonId: "lesson-1",
        operation,
      })
    ).rejects.toThrow("session changed");
    expect(query).toHaveBeenCalledWith("rollback");
    expect(query).not.toHaveBeenCalledWith("commit");
  });
});
