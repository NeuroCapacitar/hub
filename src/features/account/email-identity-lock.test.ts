import { describe, expect, it, vi } from "vitest";

import {
  lockAccountEmailIdentities,
  lockAccountEmailIdentity,
} from "./email-identity-lock";

describe("account email advisory locks", () => {
  it("normalizes, deduplicates, and sorts multiple identities before locking", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await lockAccountEmailIdentities({ query } as never, [
      "B@example.test",
      "a@example.test",
      "b@example.test",
    ]);

    expect(query.mock.calls.map(([, values]) => values)).toEqual([
      ["account-email:a@example.test"],
      ["account-email:b@example.test"],
    ]);
  });

  it("returns the canonical identity for a single lock", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await expect(
      lockAccountEmailIdentity({ query } as never, "Person@Example.Test")
    ).resolves.toBe("person@example.test");
    expect(query).toHaveBeenCalledWith(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["account-email:person@example.test"]
    );
  });
});
