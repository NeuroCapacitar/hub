import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ BETTER_AUTH_SECRET: "a".repeat(48) }),
}));

import { consumeBetterAuthRateLimit } from "./better-auth-rate-limit-storage";

describe("Better Auth shared rate-limit storage", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("atomically records only a keyed digest of the request key", async () => {
    query.mockResolvedValue({ rows: [{ request_count: 1 }] });
    const key = "198.51.100.8|/sign-in/email";

    await expect(
      consumeBetterAuthRateLimit(key, { max: 3, window: 10 })
    ).resolves.toEqual({ allowed: true, retryAfter: null });

    const [statement, values] = query.mock.calls[0] ?? [];
    const expectedHash = createHmac("sha256", "a".repeat(48))
      .update("hub:better-auth-rate-limit:v1\0")
      .update(key)
      .digest("hex");
    expect(statement).toContain("on conflict (key_hash) do update");
    expect(statement).toContain("request_count < $3");
    expect(values).toEqual([expectedHash, 10, 3]);
    expect(JSON.stringify(values)).not.toContain("198.51.100.8");
  });

  it("returns the stored window remainder without updating a blocked bucket", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ retry_after: 7 }] });

    await expect(
      consumeBetterAuthRateLimit("203.0.113.4|/sign-in/email", {
        max: 3,
        window: 10,
      })
    ).resolves.toEqual({ allowed: false, retryAfter: 7 });

    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "where better_auth_rate_limits.expires_at <= now()"
    );
    expect(String(query.mock.calls[1]?.[0])).toContain("select greatest(");
  });
});
