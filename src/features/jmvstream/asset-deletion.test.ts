import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, release, provider } = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  provider: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ query, connect: async () => ({ query, release }) }),
}));
vi.mock("./auth", () => ({ getConfiguredJmvstreamClient: provider }));

import {
  deleteReplacedJmvstreamAssets,
  retryJmvstreamAssetDelete,
} from "./asset-deletion";

describe("JMVStream retry deletion eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it("rejects a ready active asset instead of invoking the provider", async () => {
    await expect(retryJmvstreamAssetDelete("active-asset")).rejects.toThrow(
      "invalido"
    );
    expect(provider).not.toHaveBeenCalled();
  });

  it("refuses an eligible retry when a protected publication still references its hash", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.startsWith("select id")) {
        return { rows: [{ id: "failed-asset" }] };
      }
      if (sql.startsWith("select course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      return { rows: [] };
    });
    await expect(retryJmvstreamAssetDelete("failed-asset")).rejects.toThrow(
      "protegido"
    );
    expect(provider).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });

  it("retains a pending replacement asset when provider setup fails without failing the committed completion", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.startsWith("select course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("returning a.video_hash")) {
        return { rows: [{ video_hash: "old-video" }] };
      }
      return { rows: [] };
    });
    provider.mockRejectedValue(new Error("provider unavailable"));
    await expect(deleteReplacedJmvstreamAssets(["old-asset"])).resolves.toEqual(
      {
        attempted: 1,
        failed: 1,
      }
    );
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("set delete_status = 'deleted'")
      )
    ).toBe(false);
  });
});
