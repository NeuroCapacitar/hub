import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getServerEnv: vi.fn(),
  logOperationalEvent: vi.fn(),
  readCurrentUserAvatar: vi.fn(),
  saveUserAvatar: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));
vi.mock("@/lib/observability", () => ({
  CORRELATION_ID_HEADER: "x-correlation-id",
  createCorrelationId: vi.fn(() => "correlation-id"),
  logOperationalEvent: dependencies.logOperationalEvent,
}));
vi.mock("@/features/account/avatar-storage", () => ({
  readCurrentUserAvatar: dependencies.readCurrentUserAvatar,
  saveUserAvatar: dependencies.saveUserAvatar,
}));

import { GET, POST } from "./route";

describe("account avatar route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_URL: "https://app.example.test",
      NEXT_PUBLIC_APP_URL: "https://app.example.test",
      BETTER_AUTH_TRUSTED_ORIGINS: "",
    });
    dependencies.getCurrentSession.mockResolvedValue({
      user: { id: "session-owner" },
    });
  });

  it("serves only the current user's private WebP avatar with no-store caching", async () => {
    dependencies.readCurrentUserAvatar.mockResolvedValue(
      Buffer.from("webp-avatar")
    );
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(dependencies.readCurrentUserAvatar).toHaveBeenCalledWith(
      "session-owner"
    );
    await expect(response.arrayBuffer()).resolves.toHaveProperty(
      "byteLength",
      11
    );
  });

  it("rejects cross-origin upload requests before reading the session", async () => {
    const response = await POST(
      new Request("https://app.example.test/api/account/avatar", {
        headers: { origin: "https://attacker.example" },
        method: "POST",
      })
    );

    expect(response.status).toBe(403);
    expect(dependencies.getCurrentSession).not.toHaveBeenCalled();
    expect(dependencies.saveUserAvatar).not.toHaveBeenCalled();
  });

  it("derives avatar ownership from the session and never accepts a user id", async () => {
    const formData = new FormData();
    formData.set(
      "file",
      new File([new Uint8Array([1, 2, 3])], "avatar.png", {
        type: "image/png",
      })
    );
    const response = await POST(
      new Request("https://app.example.test/api/account/avatar", {
        body: formData,
        headers: { origin: "https://app.example.test" },
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(dependencies.saveUserAvatar).toHaveBeenCalledWith({
      file: expect.any(File),
      userId: "session-owner",
    });
    expect(Object.keys(dependencies.saveUserAvatar.mock.calls[0]?.[0])).toEqual(
      ["file", "userId"]
    );
  });

  it("requires authentication for avatar reads and uploads", async () => {
    dependencies.getCurrentSession.mockResolvedValue(null);
    const getResponse = await GET();
    const postResponse = await POST(
      new Request("https://app.example.test/api/account/avatar", {
        body: new FormData(),
        headers: { origin: "https://app.example.test" },
        method: "POST",
      })
    );

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
  });

  it("denies avatar reads and uploads to a suspended Student", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: new Date("2026-09-30T12:00:00.000Z"),
      role: "student",
      user: { id: "session-owner" },
    });

    const getResponse = await GET();
    const postResponse = await POST(
      new Request("https://app.example.test/api/account/avatar", {
        body: new FormData(),
        headers: { origin: "https://app.example.test" },
        method: "POST",
      })
    );

    expect(getResponse.status).toBe(403);
    await expect(getResponse.json()).resolves.toEqual({
      error: "account_suspended",
    });
    expect(postResponse.status).toBe(403);
    await expect(postResponse.json()).resolves.toEqual({
      error: "account_suspended",
    });
    expect(dependencies.readCurrentUserAvatar).not.toHaveBeenCalled();
    expect(dependencies.saveUserAvatar).not.toHaveBeenCalled();
  });
});
