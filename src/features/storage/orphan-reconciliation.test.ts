import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  listPrivateR2Objects: vi.fn(),
  listPublicR2Objects: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/storage/r2", () => dependencies);

import { reconcileUnreferencedR2Objects } from "./orphan-reconciliation";

describe("reconcileUnreferencedR2Objects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.listPrivateR2Objects.mockResolvedValue([]);
    dependencies.listPublicR2Objects.mockResolvedValue([]);
  });

  it("removes only unreferenced objects past the grace period in both buckets", async () => {
    const removeObject = vi.fn().mockResolvedValue(undefined);
    const now = new Date("2026-09-25T00:00:00.000Z");
    dependencies.listPrivateR2Objects.mockResolvedValue([
      {
        key: "media/current.webp",
        lastModified: new Date("2026-09-20T00:00:00.000Z"),
      },
      {
        key: "media/old-private.webp",
        lastModified: new Date("2026-09-22T00:00:00.000Z"),
      },
      {
        key: "media/copied-recently.webp",
        lastModified: new Date("2026-09-22T00:00:00.000Z"),
      },
      {
        key: "other/old.webp",
        lastModified: new Date("2026-09-20T00:00:00.000Z"),
      },
    ]);
    dependencies.listPublicR2Objects.mockResolvedValue([
      {
        key: "media/old-private.webp",
        lastModified: new Date("2026-09-22T00:00:00.000Z"),
      },
      {
        key: "media/copied-recently.webp",
        lastModified: new Date("2026-09-24T12:00:00.000Z"),
      },
    ]);

    await expect(
      reconcileUnreferencedR2Objects({
        isEligibleKey: (key) => key.startsWith("media/"),
        now,
        prefix: "media/",
        referencedKeys: new Set(["media/current.webp"]),
        removeObject,
      })
    ).resolves.toBe(1);

    expect(dependencies.listPrivateR2Objects).toHaveBeenCalledWith("media/");
    expect(dependencies.listPublicR2Objects).toHaveBeenCalledWith("media/");
    expect(removeObject).toHaveBeenCalledOnce();
    expect(removeObject).toHaveBeenCalledWith("media/old-private.webp");
  });

  it("keeps an orphan if either object listing fails so a later run can retry", async () => {
    const removeObject = vi.fn();
    dependencies.listPublicR2Objects.mockRejectedValue(new Error("R2 offline"));

    await expect(
      reconcileUnreferencedR2Objects({
        isEligibleKey: (key) => key.startsWith("media/"),
        prefix: "media/",
        referencedKeys: new Set(),
        removeObject,
      })
    ).resolves.toBe(0);

    expect(removeObject).not.toHaveBeenCalled();
  });

  it("stops deleting when the maintenance lease is no longer available", async () => {
    const removeObject = vi.fn().mockResolvedValue(undefined);
    dependencies.listPrivateR2Objects.mockResolvedValue([
      {
        key: "media/old.webp",
        lastModified: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    const shouldContinue = vi.fn().mockResolvedValue(false);

    await expect(
      reconcileUnreferencedR2Objects({
        isEligibleKey: (key) => key.startsWith("media/"),
        now: new Date("2026-09-25T00:00:00.000Z"),
        prefix: "media/",
        referencedKeys: new Set(),
        removeObject,
        shouldContinue,
      })
    ).resolves.toBe(0);

    expect(removeObject).not.toHaveBeenCalled();
  });
});
