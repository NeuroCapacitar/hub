import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assertLessonResourcesAvailable,
  queueRemovedLessonResources,
} from "./lesson-resource-lifecycle";

const resource = {
  id: "r1",
  key: "lessons/l1/resources/r1.pdf",
  contentType: "application/pdf",
  fileName: "r1.pdf",
  label: "Material",
  sizeBytes: 3,
  storage: "r2" as const,
};
describe("resource lifecycle", () => {
  it("rejects references to cleaning/deleted keys including previews", async () => {
    const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({
      rows: [{ resource_id: "r1" }],
      rowCount: 1,
    }));
    await expect(
      assertLessonResourcesAvailable({
        queryable: { query },
        resources: [resource],
      })
    ).rejects.toThrow("limpeza");
    expect(query.mock.calls[0]).toEqual([
      expect.stringContaining("status in ('cleaning', 'deleted')"),
      [[resource.key]],
    ]);
  });
  it("queues removed immutable tuples without reviving lifecycle states", async () => {
    const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({
      rows: [],
      rowCount: 1,
    }));
    await queueRemovedLessonResources({
      actorUserId: "a1",
      lessonId: "l1",
      queryable: { query },
      previousResources: [resource],
      nextResources: [],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("on conflict (object_key) do update set"),
      expect.arrayContaining([
        resource.key,
        resource.fileName,
        resource.sizeBytes,
      ])
    );
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql.slice(sql.indexOf("on conflict"))).not.toContain("status =");
  });
  it("does not queue a reference kept by the committed save", async () => {
    const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({
      rows: [],
      rowCount: 1,
    }));
    await queueRemovedLessonResources({
      actorUserId: "a1",
      lessonId: "l1",
      queryable: { query },
      previousResources: [resource],
      nextResources: [resource],
    });
    expect(query).not.toHaveBeenCalled();
  });
});
