import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deletePublicR2Objects: vi.fn(),
  deleteR2Objects: vi.fn(),
  getPool: vi.fn(),
  listPrivateR2Objects: vi.fn(),
  listPublicR2Objects: vi.fn(),
  query: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  deletePublicR2Objects: dependencies.deletePublicR2Objects,
  deleteR2Objects: dependencies.deleteR2Objects,
  listPrivateR2Objects: dependencies.listPrivateR2Objects,
  listPublicR2Objects: dependencies.listPublicR2Objects,
}));

import { reconcileDashboardBannerStorage } from "./banner-storage-reconciliation";

describe("dashboard banner storage reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getPool.mockReturnValue({ query: dependencies.query });
    dependencies.query.mockResolvedValue({ rows: [] });
    dependencies.deletePublicR2Objects.mockResolvedValue(undefined);
    dependencies.deleteR2Objects.mockResolvedValue(undefined);
    dependencies.listPrivateR2Objects.mockResolvedValue([]);
    dependencies.listPublicR2Objects.mockResolvedValue([]);
  });

  it("retains referenced and recent objects while deleting stale private and public orphans", async () => {
    const referencedKey = "banners/current.webp";
    const orphanKey = "banners/old.webp";
    dependencies.query.mockResolvedValue({
      rows: [{ image_url: referencedKey }],
    });
    dependencies.listPrivateR2Objects.mockResolvedValue([
      {
        key: referencedKey,
        lastModified: new Date("2026-09-01T00:00:00.000Z"),
      },
      { key: orphanKey, lastModified: new Date("2026-09-22T00:00:00.000Z") },
    ]);
    dependencies.listPublicR2Objects.mockResolvedValue([
      { key: orphanKey, lastModified: new Date("2026-09-22T00:00:00.000Z") },
      {
        key: "banners/recent.webp",
        lastModified: new Date("2026-09-24T12:00:00.000Z"),
      },
    ]);

    await expect(
      reconcileDashboardBannerStorage({
        now: new Date("2026-09-25T00:00:00.000Z"),
      })
    ).resolves.toBe(1);

    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([orphanKey]);
    expect(dependencies.deletePublicR2Objects).toHaveBeenCalledWith([
      orphanKey,
    ]);
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalledWith([
      referencedKey,
    ]);
  });

  it("fails closed when a stored banner reference is not a recognized object key", async () => {
    dependencies.query.mockResolvedValue({
      rows: [{ image_url: "https://legacy.example/banner.webp" }],
    });

    await expect(
      reconcileDashboardBannerStorage({
        now: new Date("2026-09-25T00:00:00.000Z"),
      })
    ).resolves.toBe(0);

    expect(dependencies.listPrivateR2Objects).not.toHaveBeenCalled();
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });
});
