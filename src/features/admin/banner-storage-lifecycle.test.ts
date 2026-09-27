import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deletePublicR2Objects: vi.fn(),
  deleteR2Objects: vi.fn(),
  publishR2Object: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/storage/r2", () => dependencies);

import { persistDashboardBannerObjects } from "./banner-storage-lifecycle";

describe("dashboard banner storage lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.deletePublicR2Objects.mockResolvedValue(undefined);
    dependencies.deleteR2Objects.mockResolvedValue(undefined);
    dependencies.publishR2Object.mockResolvedValue(undefined);
  });

  it("publishes the new object before persisting its pointer and defers old-object cleanup", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);

    await persistDashboardBannerObjects({
      isActive: true,
      newImageUploaded: true,
      nextImageKey: "private/new.webp",
      persist,
      previousImageKey: "private/old.webp",
      previousIsActive: true,
    });

    expect(dependencies.publishR2Object).toHaveBeenCalledWith(
      "private/new.webp"
    );
    expect(persist).toHaveBeenCalledOnce();
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalledWith([
      "private/old.webp",
    ]);
    expect(dependencies.deletePublicR2Objects).not.toHaveBeenCalledWith([
      "private/old.webp",
    ]);
    expect(
      dependencies.publishR2Object.mock.invocationCallOrder[0]
    ).toBeLessThan(
      persist.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it("cleans the uploaded object and rejects a stale banner revision", async () => {
    const persist = vi.fn().mockResolvedValue(false);

    await expect(
      persistDashboardBannerObjects({
        isActive: true,
        newImageUploaded: true,
        nextImageKey: "private/new.webp",
        persist,
        previousImageKey: "private/old.webp",
        previousIsActive: true,
      })
    ).rejects.toThrow("O Banner foi alterado em outra sessão");

    expect(dependencies.publishR2Object).toHaveBeenCalledWith(
      "private/new.webp"
    );
    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "private/new.webp",
    ]);
    expect(dependencies.deletePublicR2Objects).toHaveBeenCalledWith([
      "private/new.webp",
    ]);
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalledWith([
      "private/old.webp",
    ]);
  });

  it("leaves the database pointer unchanged and removes the new object if publishing fails", async () => {
    const persist = vi.fn();
    dependencies.publishR2Object.mockRejectedValueOnce(
      new Error("copy failed")
    );

    await expect(
      persistDashboardBannerObjects({
        isActive: true,
        newImageUploaded: true,
        nextImageKey: "private/new.webp",
        persist,
        previousImageKey: "private/old.webp",
        previousIsActive: true,
      })
    ).rejects.toThrow("copy failed");

    expect(persist).not.toHaveBeenCalled();
    expect(dependencies.deletePublicR2Objects).toHaveBeenCalledWith([
      "private/new.webp",
    ]);
    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "private/new.webp",
    ]);
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalledWith([
      "private/old.webp",
    ]);
  });

  it("restores the previous public state if database persistence fails", async () => {
    const persist = vi.fn().mockRejectedValue(new Error("database failed"));

    await expect(
      persistDashboardBannerObjects({
        isActive: false,
        newImageUploaded: false,
        nextImageKey: "private/current.webp",
        persist,
        previousImageKey: "private/current.webp",
        previousIsActive: true,
      })
    ).rejects.toThrow("database failed");

    expect(dependencies.deletePublicR2Objects).toHaveBeenCalledWith([
      "private/current.webp",
    ]);
    expect(dependencies.publishR2Object).toHaveBeenCalledWith(
      "private/current.webp"
    );
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });
});
