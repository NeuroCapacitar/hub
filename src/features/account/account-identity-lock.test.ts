import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { lockAccountIdentity } from "./account-identity-lock";

describe("lockAccountIdentity", () => {
  it("acquires the transaction lock using the stable account identity key", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: null });

    await lockAccountIdentity({ query }, "student-123");

    expect(query).toHaveBeenCalledExactlyOnceWith(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["account-email-change:student-123"]
    );
  });
});
