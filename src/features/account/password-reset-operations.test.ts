import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/lib/client-ip", () => ({
  getClientIpAddress: vi.fn(() => "203.0.113.44"),
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    BETTER_AUTH_SECRET: "b".repeat(48),
    CLIENT_IP_SOURCE: "x-forwarded-for",
    E2E_TEST_MODE: false,
    NODE_ENV: "test",
  }),
}));

import {
  assertNoPasswordResetInProgress,
  withAccountPasswordResetOperation,
} from "./password-reset-operations";

const operationId = "8b5f2d8e-dc4d-43a3-9c1b-35dcac2a2a32";

const setPoolQuery = (
  handler: (statement: string, values: unknown[]) => unknown
) => {
  const query = vi.fn(async (statement: string, values: unknown[] = []) =>
    statement.includes("insert into account_email_challenge_rate_limits")
      ? { rows: [{ request_count: 1 }] }
      : handler(statement, values)
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
    expect(query).toHaveBeenCalledTimes(5);
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("insert into account_password_reset_operations"),
      expect.anything()
    );
  });

  it("rate limits reset requests before account lookup with the same neutral response", async () => {
    const { query } = setPoolQuery((statement) => {
      if (statement.includes("from users")) {
        return { rows: [{ id: "must-not-be-read" }] };
      }
      return { rows: [] };
    });
    query.mockImplementation((statement) => {
      if (
        statement.includes("insert into account_email_challenge_rate_limits")
      ) {
        return Promise.resolve({ rows: [{ request_count: 11 }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const handler = vi.fn();

    const startedAt = performance.now();
    const response = await withAccountPasswordResetOperation({
      endpoint: "request-password-reset",
      handler,
      request: new Request(
        "https://hub.example.test/api/auth/request-password-reset",
        {
          body: JSON.stringify({ email: "person@example.test" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      ),
    });

    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(250);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: true });
    expect(handler).not.toHaveBeenCalled();
    const executedStatements = query.mock.calls.map(([statement]) =>
      String(statement)
    );
    expect(executedStatements[0]).toBe("begin");
    expect(executedStatements[1]).toContain(
      "insert into account_email_challenge_rate_limits"
    );
    expect(executedStatements[2]).toContain(
      "insert into account_email_challenge_rate_limits"
    );
    expect(executedStatements[3]).toBe("commit");
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("rate limits reset-token consumption before looking up the token", async () => {
    const { query } = setPoolQuery(() => ({ rows: [] }));
    query.mockImplementation(async (statement) =>
      statement.includes("insert into account_email_challenge_rate_limits")
        ? { rows: [{ request_count: 11 }] }
        : { rows: [] }
    );
    const handler = vi.fn();

    const response = await withAccountPasswordResetOperation({
      endpoint: "reset-password",
      handler,
      request: new Request("https://hub.example.test/api/auth/reset-password", {
        body: JSON.stringify({ token: "sensitive-reset-token" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ code: "RATE_LIMITED" });
    expect(handler).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(4);
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
