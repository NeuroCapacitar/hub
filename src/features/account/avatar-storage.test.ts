import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createCorrelationId: vi.fn(),
  deletePrivateUserAvatarObject: vi.fn(),
  getPool: vi.fn(),
  listPrivateR2Objects: vi.fn(),
  logOperationalEvent: vi.fn(),
  processUserAvatarImage: vi.fn(),
  readPrivateUserAvatarObject: vi.fn(),
  uploadPrivateUserAvatarObject: vi.fn(),
}));
const USER_AVATAR_KEY_PATTERN = /^user-avatars\/user-1\/.+\.webp$/;

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/account/avatar-image", () => ({
  processUserAvatarImage: dependencies.processUserAvatarImage,
}));
vi.mock("@/features/storage/r2", () => ({
  deletePrivateUserAvatarObject: dependencies.deletePrivateUserAvatarObject,
  deleteR2Objects: vi.fn(),
  listPrivateR2Objects: dependencies.listPrivateR2Objects,
  readPrivateUserAvatarObject: dependencies.readPrivateUserAvatarObject,
  uploadPrivateUserAvatarObject: dependencies.uploadPrivateUserAvatarObject,
}));
vi.mock("@/lib/observability", () => ({
  createCorrelationId: dependencies.createCorrelationId,
  logOperationalEvent: dependencies.logOperationalEvent,
}));
vi.mock("@/features/storage/orphan-reconciliation", () => ({
  reconcileUnreferencedR2Objects: vi.fn(),
}));

import {
  readCurrentUserAvatar,
  reconcileUnusedUserAvatars,
  removeUserAvatar,
  saveUserAvatar,
} from "./avatar-storage";

describe("private user avatar storage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.createCorrelationId.mockReturnValue("correlation-id");
    dependencies.processUserAvatarImage.mockResolvedValue({
      body: Buffer.from("webp-data"),
      contentType: "image/webp",
      height: 512,
      width: 512,
    });
  });

  it("refuses an avatar key owned by a different account", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          avatar_key:
            "user-avatars/user-2/44b1793a-6381-48a2-9002-6acfe70a0a20.webp",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(readCurrentUserAvatar("user-1")).rejects.toThrow(
      "Avatar privado inválido"
    );
    expect(dependencies.readPrivateUserAvatarObject).not.toHaveBeenCalled();
  });

  it("removes a freshly uploaded object if the profile update fails", async () => {
    const clientQuery = vi.fn((statement: string) => {
      if (statement.includes("select profiles.avatar_key")) {
        return Promise.resolve({
          rows: [
            {
              avatar_key: null,
              google_image: "https://google.example.test/photo.png",
            },
          ],
        });
      }
      if (statement.includes("update profiles")) {
        return Promise.reject(new Error("db unavailable"));
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });
    const client = {
      query: clientQuery,
      release: vi.fn(),
    } as unknown as PoolClient;
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
    });

    await expect(
      saveUserAvatar({
        file: new File([new Uint8Array([1])], "photo.png", {
          type: "image/png",
        }),
        userId: "user-1",
      })
    ).rejects.toThrow("db unavailable");

    const upload =
      dependencies.uploadPrivateUserAvatarObject.mock.calls[0]?.[0];
    expect(upload?.key).toMatch(USER_AVATAR_KEY_PATTERN);
    expect(dependencies.deletePrivateUserAvatarObject).toHaveBeenCalledWith({
      key: upload?.key,
      userId: "user-1",
    });
    expect(clientQuery).toHaveBeenCalledWith("rollback");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("commits the new avatar before deleting the previous object", async () => {
    const previousKey =
      "user-avatars/user-1/1e786eff-8878-4604-9a8f-df9bf801565a.webp";
    const calls: string[] = [];
    const clientQuery = vi.fn((statement: string) => {
      calls.push(statement);
      if (statement.includes("select profiles.avatar_key")) {
        return Promise.resolve({
          rows: [
            {
              avatar_key: previousKey,
              google_image: "https://google.example.test/photo.png",
            },
          ],
        });
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });
    const client = {
      query: clientQuery,
      release: vi.fn(),
    } as unknown as PoolClient;
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
    });
    dependencies.deletePrivateUserAvatarObject.mockImplementation(() => {
      calls.push("delete-object");
    });

    await saveUserAvatar({
      file: new File([new Uint8Array([1])], "photo.png", {
        type: "image/png",
      }),
      userId: "user-1",
    });

    const commitIndex = calls.indexOf("commit");
    const deleteIndex = calls.indexOf("delete-object");
    expect(commitIndex).toBeGreaterThanOrEqual(0);
    expect(deleteIndex).toBeGreaterThan(commitIndex);
    expect(dependencies.deletePrivateUserAvatarObject).toHaveBeenCalledWith({
      key: previousKey,
      userId: "user-1",
    });
  });

  it("resets the image fallback when no custom photo exists", async () => {
    const query = vi
      .fn()
      .mockImplementation((statement: string) =>
        statement.includes("select profiles.avatar_key")
          ? Promise.resolve({ rows: [{ avatar_key: null }] })
          : Promise.resolve({ rowCount: 1, rows: [] })
      );
    const client = {
      query,
      release: vi.fn(),
    } as unknown as PoolClient;
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
    });

    await removeUserAvatar({ userId: "user-1" });

    const updateCall = query.mock.calls.find(([statement]) =>
      String(statement).includes("update profiles")
    );
    expect(updateCall?.[0]).toContain("avatar_mode = 'initials'");
    expect(dependencies.deletePrivateUserAvatarObject).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("deletes a custom object when the user removes the profile photo", async () => {
    const previousKey =
      "user-avatars/user-1/1e786eff-8878-4604-9a8f-df9bf801565a.webp";
    const query = vi.fn().mockImplementation((statement: string) =>
      statement.includes("select profiles.avatar_key")
        ? Promise.resolve({
            rows: [{ avatar_key: previousKey }],
          })
        : Promise.resolve({ rowCount: 1, rows: [] })
    );
    const client = {
      query,
      release: vi.fn(),
    } as unknown as PoolClient;
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
    });

    await removeUserAvatar({ userId: "user-1" });

    expect(dependencies.deletePrivateUserAvatarObject).toHaveBeenCalledWith({
      key: previousKey,
      userId: "user-1",
    });
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("removes only valid, unreferenced avatar objects older than the grace period", async () => {
    const now = new Date("2026-09-30T12:00:00.000Z");
    const activeKey =
      "user-avatars/user-1/1e786eff-8878-4604-9a8f-df9bf801565a.webp";
    const orphanKey =
      "user-avatars/user-2/2e786eff-8878-4604-9a8f-df9bf801565a.webp";
    const recentKey =
      "user-avatars/user-2/3e786eff-8878-4604-9a8f-df9bf801565a.webp";
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [{ avatar_key: activeKey }] }),
    });
    dependencies.listPrivateR2Objects.mockResolvedValue([
      { key: activeKey, lastModified: new Date("2026-09-28T00:00:00.000Z") },
      { key: orphanKey, lastModified: new Date("2026-09-29T00:00:00.000Z") },
      { key: recentKey, lastModified: new Date("2026-09-30T01:00:00.000Z") },
      {
        key: "user-avatars/../invalid.webp",
        lastModified: new Date("2026-09-28T00:00:00.000Z"),
      },
    ]);

    await expect(reconcileUnusedUserAvatars({ now })).resolves.toBe(1);
    expect(dependencies.deletePrivateUserAvatarObject).toHaveBeenCalledOnce();
    expect(dependencies.deletePrivateUserAvatarObject).toHaveBeenCalledWith({
      key: orphanKey,
      userId: "user-2",
    });
  });

  it("records an operational failure when R2 listing prevents orphan cleanup", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    });
    dependencies.listPrivateR2Objects.mockRejectedValue(
      new Error("R2 unavailable")
    );

    await expect(reconcileUnusedUserAvatars()).resolves.toBe(0);

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith({
      correlationId: "correlation-id",
      errorCode: "avatar_orphan_listing_failed",
      operation: "account.avatar.storage",
      outcome: "failure",
      provider: "r2",
    });
  });
});
