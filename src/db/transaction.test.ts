import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import { withPostgresTransaction } from "./transaction";

describe("withPostgresTransaction", () => {
  const query = vi.fn();
  const release = vi.fn();

  beforeEach(() => {
    query.mockReset();
    release.mockReset();
    query.mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReset().mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });
  });

  it("commits successful work and releases its client", async () => {
    await expect(withPostgresTransaction(async () => "saved")).resolves.toBe(
      "saved"
    );

    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      "begin",
      "commit",
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back failed work and preserves the original error", async () => {
    const failure = new Error("operation failed");
    await expect(
      withPostgresTransaction(() => {
        throw failure;
      })
    ).rejects.toBe(failure);

    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      "begin",
      "rollback",
    ]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("does not issue rollback when beginning the transaction fails", async () => {
    query.mockRejectedValueOnce(new Error("connection failed"));

    await expect(
      withPostgresTransaction(async () => "unreachable")
    ).rejects.toThrow("connection failed");

    expect(query).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });
});
