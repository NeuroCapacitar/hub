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

import { reconcileCourseCoverStorage } from "./course-cover-reconciliation";

const coverImage = (key: string) => ({
  variants: {
    card: {
      contentType: "image/webp",
      height: 720,
      key,
      sizeBytes: 1024,
      width: 1280,
    },
  },
});

describe("course cover storage reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getPool.mockReturnValue({ query: dependencies.query });
    dependencies.query.mockResolvedValue({ rows: [] });
    dependencies.deletePublicR2Objects.mockResolvedValue(undefined);
    dependencies.deleteR2Objects.mockResolvedValue(undefined);
    dependencies.listPrivateR2Objects.mockResolvedValue([]);
    dependencies.listPublicR2Objects.mockResolvedValue([]);
  });

  it("retains referenced covers and old cache targets through the grace period", async () => {
    const currentKey = "courses/course-1/cover/current-card.webp";
    const previousKey = "courses/course-1/cover/previous-card.webp";
    dependencies.query.mockResolvedValue({
      rows: [{ cover_image_json: coverImage(currentKey) }],
    });
    dependencies.listPrivateR2Objects.mockResolvedValue([
      { key: currentKey, lastModified: new Date("2026-09-01T00:00:00.000Z") },
      { key: previousKey, lastModified: new Date("2026-09-22T00:00:00.000Z") },
      {
        key: "courses/course-1/modules/not-a-cover.webp",
        lastModified: new Date("2026-09-20T00:00:00.000Z"),
      },
    ]);
    dependencies.listPublicR2Objects.mockResolvedValue([
      { key: previousKey, lastModified: new Date("2026-09-22T00:00:00.000Z") },
    ]);

    await expect(
      reconcileCourseCoverStorage({
        now: new Date("2026-09-25T00:00:00.000Z"),
      })
    ).resolves.toBe(1);

    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([previousKey]);
    expect(dependencies.deletePublicR2Objects).toHaveBeenCalledWith([
      previousKey,
    ]);
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalledWith([currentKey]);
  });

  it("does not sweep covers if a stored cover reference cannot be parsed", async () => {
    dependencies.query.mockResolvedValue({
      rows: [
        { cover_image_json: { variants: { card: { key: "malformed" } } } },
      ],
    });

    await expect(
      reconcileCourseCoverStorage({
        now: new Date("2026-09-25T00:00:00.000Z"),
      })
    ).resolves.toBe(0);

    expect(dependencies.listPrivateR2Objects).not.toHaveBeenCalled();
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });
});
