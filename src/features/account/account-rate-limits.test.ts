import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ BETTER_AUTH_SECRET: "a".repeat(48) }),
}));

import { consumeAccountRateLimit } from "./account-rate-limits";

describe("consumeAccountRateLimit", () => {
  it("stores only a keyed digest and atomically increments the rolling counter", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ request_count: 2 }] });

    await expect(
      consumeAccountRateLimit({
        client: { query } as never,
        key: "email:student@example.test",
        limit: 3,
        namespace: "hub:password-reset-rate-limit:v1",
        windowMs: 60_000,
      })
    ).resolves.toBe(true);

    const [statement, values] = query.mock.calls[0] ?? [];
    const expectedHash = createHmac("sha256", "a".repeat(48))
      .update("hub:password-reset-rate-limit:v1\0")
      .update("email:student@example.test")
      .digest("hex");
    expect(statement).toContain("on conflict (key_hash) do update");
    expect(values).toEqual([expectedHash, 60_000]);
    expect(JSON.stringify(values)).not.toContain("student@example.test");
  });

  it("rejects counts above the configured limit and missing database results", async () => {
    const aboveLimit = vi.fn().mockResolvedValue({
      rows: [{ request_count: 4 }],
    });
    const missingResult = vi.fn().mockResolvedValue({ rows: [] });
    const input = {
      key: "ip:192.0.2.1",
      limit: 3,
      namespace: "hub:password-reset-rate-limit:v1",
      windowMs: 60_000,
    };

    await expect(
      consumeAccountRateLimit({
        client: { query: aboveLimit } as never,
        ...input,
      })
    ).resolves.toBe(false);
    await expect(
      consumeAccountRateLimit({
        client: { query: missingResult } as never,
        ...input,
      })
    ).resolves.toBe(false);
  });
});
