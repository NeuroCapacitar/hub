import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deletePublicR2Objects: vi.fn().mockResolvedValue(undefined),
  deleteR2Objects: vi.fn().mockResolvedValue(undefined),
  getPool: vi.fn(),
  listPrivateR2Objects: vi.fn(),
  listPublicR2Objects: vi.fn(),
  publishR2Object: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  deletePublicR2Objects: dependencies.deletePublicR2Objects,
  deleteR2Objects: dependencies.deleteR2Objects,
  listPrivateR2Objects: dependencies.listPrivateR2Objects,
  listPublicR2Objects: dependencies.listPublicR2Objects,
  publishR2Object: dependencies.publishR2Object,
}));

import {
  reconcileAuthMediaStorage,
  runWithAuthMediaStorageRetry,
} from "./storage";

type Wait = (durationMs: number) => Promise<void>;

describe("authentication media storage retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getPool.mockReturnValue({ query: dependencies.query });
  });

  it("retries transient failures with bounded backoff", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue("published");
    const wait = vi.fn<Wait>(() => Promise.resolve());

    await expect(
      runWithAuthMediaStorageRetry({ operation, wait })
    ).resolves.toBe("published");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 100);
    expect(wait).toHaveBeenNthCalledWith(2, 250);
  });

  it("does not retry after the configured attempt budget", async () => {
    const failure = new Error("permanent");
    const operation = vi.fn<() => Promise<void>>().mockRejectedValue(failure);
    const wait = vi.fn<Wait>(() => Promise.resolve());

    await expect(
      runWithAuthMediaStorageRetry({ maxAttempts: 2, operation, wait })
    ).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledOnce();
  });

  it("repairs referenced objects and removes stale unreferenced objects", async () => {
    const referencedKey =
      "auth-media/c989d54d-d13f-46a1-89ed-2069d7c1c45b/44feef7e-1b03-46c4-8119-ad22e5e57826.webp";
    const inactiveKey =
      "auth-media/44feef7e-1b03-46c4-8119-ad22e5e57826/c989d54d-d13f-46a1-89ed-2069d7c1c45b.webp";
    const orphanKey =
      "auth-media/44feef7e-1b03-46c4-8119-ad22e5e57826/c989d54d-d13f-46a1-89ed-2069d7c1c45c.webp";
    dependencies.query.mockResolvedValue({
      rows: [
        { image_url: referencedKey, is_active: true },
        { image_url: inactiveKey, is_active: false },
      ],
    });
    dependencies.listPrivateR2Objects.mockResolvedValue([
      {
        key: referencedKey,
        lastModified: new Date("2026-09-13T23:00:00.000Z"),
      },
      {
        key: orphanKey,
        lastModified: new Date("2026-09-12T00:00:00.000Z"),
      },
    ]);
    dependencies.listPublicR2Objects.mockResolvedValue([
      {
        key: orphanKey,
        lastModified: new Date("2026-09-12T00:00:00.000Z"),
      },
    ]);

    await expect(
      reconcileAuthMediaStorage({
        now: new Date("2026-09-14T00:00:00.000Z"),
      })
    ).resolves.toBe(3);
    expect(dependencies.publishR2Object).toHaveBeenCalledWith(referencedKey);
    expect(dependencies.deletePublicR2Objects).toHaveBeenCalledWith([
      orphanKey,
    ]);
    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([orphanKey]);
  });
});
