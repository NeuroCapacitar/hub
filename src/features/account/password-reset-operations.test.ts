import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import {
  assertNoPasswordResetInProgress,
  withAccountPasswordResetOperation,
} from "./password-reset-operations";

const operationId = "8b5f2d8e-dc4d-43a3-9c1b-35dcac2a2a32";

const setPoolQuery = (
  handler: (statement: string, values: unknown[]) => unknown
) => {
  const query = vi.fn(async (statement: string, values: unknown[] = []) =>
    handler(statement, values)
  );
  const client = { query, release: vi.fn() };
  dependencies.getPool.mockReturnValue({
    connect: vi.fn().mockResolvedValue(client),
  });
  return { client, query };
};

describe("account password reset operation guard", () => {
  beforeEach(() => {
    dependencies.getPool.mockReset();
  });

  it("serializes reset-link requests with email identity changes", async () => {
    const { client, query } = setPoolQuery((statement) => {
      if (statement.includes("from users")) {
        return { rows: [{ id: "student-1" }] };
      }
      return { rows: [] };
    });
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));

    const response = await withAccountPasswordResetOperation({
      endpoint: "request-password-reset",
      handler,
      request: new Request(
        "https://hub.example.test/api/auth/request-password-reset",
        {
          body: JSON.stringify({ email: "First.Last+course@gmail.com" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      ),
    });

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      ["account-email-change:student-1"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into account_password_reset_operations"),
      [expect.any(String), "student-1", "request", 15]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("delete from account_password_reset_operations"),
      [expect.any(String), "student-1"]
    );
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it("serializes token consumption and removes its guard even when Better Auth throws", async () => {
    const { query } = setPoolQuery((statement) => {
      if (statement.includes("from verifications")) {
        return { rows: [{ id: "verification-1", user_id: "student-1" }] };
      }
      return { rows: [] };
    });
    const handler = vi.fn().mockRejectedValue(new Error("reset failed"));

    await expect(
      withAccountPasswordResetOperation({
        endpoint: "reset-password",
        handler,
        request: new Request(
          "https://hub.example.test/api/auth/reset-password",
          {
            body: JSON.stringify({ token: "secret-reset-token" }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }
        ),
      })
    ).rejects.toThrow("reset failed");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      ["account-email-change:student-1"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into account_password_reset_operations"),
      [expect.any(String), "student-1", "consume", 15]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("delete from account_password_reset_operations"),
      [expect.any(String), "student-1"]
    );
  });

  it("calls Better Auth normally when there is no matching account or reset token", async () => {
    const { query } = setPoolQuery(() => ({ rows: [] }));
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));

    await withAccountPasswordResetOperation({
      endpoint: "reset-password",
      handler,
      request: new Request("https://hub.example.test/api/auth/reset-password", {
        body: JSON.stringify({ token: "expired-token" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledTimes(3);
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("insert into account_password_reset_operations"),
      expect.anything()
    );
  });

  it("blocks email changes while a password reset operation is active", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: operationId }] });

    await expect(
      assertNoPasswordResetInProgress({ query } as never, "student-1")
    ).rejects.toThrow("account_password_reset_in_progress");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("expires_at > now()"),
      ["student-1"]
    );
  });
});
