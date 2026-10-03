import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deleteR2Objects: vi.fn(),
  getPool: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  deleteR2Objects: dependencies.deleteR2Objects,
}));

import { reconcileExpiredLessonResourceUploads } from "./lesson-resource-upload-cleanup";

const candidate = {
  object_key: "lessons/lesson-1/resources/material.pdf",
  preview_object_key: "lessons/lesson-1/resources/preview.webp",
  resource_id: "resource-1",
};
const setup = ({ referenced = [] as string[], claimed = true } = {}) => {
  let inTransaction = false;
  const query = vi.fn(async (sql: string) =>
    sql.includes("select resource_id, object_key")
      ? { rowCount: 1, rows: [candidate] }
      : { rowCount: 1, rows: [] }
  );
  const clientQuery = vi.fn((sql: string) => {
    if (sql === "begin") {
      inTransaction = true;
    }
    if (sql === "commit" || sql === "rollback") {
      inTransaction = false;
    }
    if (sql.includes("returning resource_id")) {
      return { rowCount: claimed ? 1 : 0, rows: claimed ? [candidate] : [] };
    }
    if (sql.includes("as referenced")) {
      return {
        rowCount: 2,
        rows: [candidate.object_key, candidate.preview_object_key].map(
          (key) => ({ key, referenced: referenced.includes(key) })
        ),
      };
    }
    return { rowCount: 1, rows: [] };
  });
  const release = vi.fn();
  dependencies.getPool.mockReturnValue({
    query,
    connect: vi.fn(async () => ({ query: clientQuery, release })),
  });
  dependencies.deleteR2Objects.mockImplementation(() => {
    expect(inTransaction).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });
  return { query, clientQuery };
};
describe("expired lesson resource upload cleanup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it("claims under lifecycle lock, deletes outside transactions and retains tombstones", async () => {
    const { query, clientQuery } = setup();
    await expect(reconcileExpiredLessonResourceUploads()).resolves.toBe(1);
    expect(clientQuery.mock.calls[1]?.[0]).toContain("pg_advisory_xact_lock");
    expect(clientQuery.mock.calls[2]?.[0]).toContain("status = 'cleaning'");
    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      candidate.object_key,
      candidate.preview_object_key,
    ]);
    expect(query.mock.calls[1]?.[0]).toContain("status = 'deleted'");
    expect(query.mock.calls[1]?.[0]).not.toContain("delete from");
  });
  it.each([
    candidate.object_key,
    candidate.preview_object_key,
  ])("preserves and releases pairs when %s is referenced", async (key) => {
    const { clientQuery } = setup({ referenced: [key] });
    await expect(reconcileExpiredLessonResourceUploads()).resolves.toBe(0);
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
    expect(clientQuery.mock.calls[4]?.[0]).toContain("status = 'consumed'");
  });
  it("does not delete a candidate whose claim no longer matches", async () => {
    setup({ claimed: false });
    await expect(reconcileExpiredLessonResourceUploads()).resolves.toBe(0);
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });
  it("retains cleaning state for retry after provider failure", async () => {
    const { query } = setup();
    dependencies.deleteR2Objects.mockRejectedValue(new Error("unavailable"));
    await expect(reconcileExpiredLessonResourceUploads()).resolves.toBe(0);
    expect(query).toHaveBeenCalledOnce();
  });
  it("stops before claiming when the worker loses its lease", async () => {
    const { clientQuery } = setup();
    await expect(
      reconcileExpiredLessonResourceUploads({
        shouldContinue: async () => false,
      })
    ).resolves.toBe(0);
    expect(clientQuery).not.toHaveBeenCalled();
  });
});
