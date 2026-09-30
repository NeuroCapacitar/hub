import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  enqueueOutboxMessage: vi.fn(),
  getPool: vi.fn(),
  getServerEnv: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));
vi.mock("@/features/admin/audit-log", () => ({
  writeAuditLog: dependencies.writeAuditLog,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));

import { createEmailChallengeToken } from "@/features/account/email-challenge-token";
import {
  consumeEmailChangeToken,
  createOrRefreshEmailChangeRequest,
  expireAccountEmailChangeRequests,
} from "./email-change";

const SECRET = "email-change-test-secret";
const REQUEST_ID = "44b1793a-6381-48a2-9002-6acfe70a0a20";
const USER_ID = "student-1";
const CURRENT_EMAIL = "current@example.test";
const NEW_EMAIL = "new@example.test";

const createToken = (expiresAt: Date, generation: number): string =>
  createEmailChallengeToken({
    challengeId: REQUEST_ID,
    expiresAt,
    generation,
    purpose: "change_email",
    secret: SECRET,
  });

const createPool = ({
  initialQuery = () => ({ rows: [] }),
  transactionQuery,
}: {
  initialQuery?: (sql: string, values: unknown[]) => unknown;
  transactionQuery: (sql: string, values: unknown[]) => unknown;
}): { initial: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> } => {
  const initial = vi.fn(async (statement: string, values: unknown[] = []) =>
    initialQuery(statement, values)
  );
  const query = vi.fn(async (statement: string, values: unknown[] = []) =>
    transactionQuery(statement, values)
  );
  const client = {
    query,
    release: vi.fn(),
  } as unknown as PoolClient;
  dependencies.getPool.mockReturnValue({
    connect: vi.fn().mockResolvedValue(client),
    query: initial,
  });
  return { initial, query };
};

const requestRow = ({
  expiresAt,
  generation,
  status,
}: {
  expiresAt: Date;
  generation: number;
  status: "pending_current" | "pending_new" | "completed";
}) => ({
  completed_at:
    status === "completed" ? new Date("2026-09-29T14:00:00.000Z") : null,
  current_confirmed_at:
    status === "pending_new" || status === "completed"
      ? new Date("2026-09-29T13:00:00.000Z")
      : null,
  current_email: CURRENT_EMAIL,
  expires_at: expiresAt,
  generation,
  id: REQUEST_ID,
  new_email: NEW_EMAIL,
  status,
  user_id: USER_ID,
});

describe("account email change flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: SECRET,
    });
    dependencies.enqueueOutboxMessage.mockResolvedValue({
      id: "outbox-email-change",
      inserted: true,
    });
    dependencies.writeAuditLog.mockResolvedValue(undefined);
  });

  it("requests current-email proof first and stores no address or token in the outbox", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const { query } = createPool({
      transactionQuery: (statement) => {
        if (
          statement.includes("select id") &&
          statement.includes("canonicalize_auth_email_identity(email)")
        ) {
          return { rows: [] };
        }
        if (
          statement.includes("from users") &&
          statement.includes("for update")
        ) {
          return { rows: [{ email: CURRENT_EMAIL, email_verified: true }] };
        }
        if (
          statement.includes("from users") &&
          statement.includes("email_verified") &&
          !statement.includes("for update")
        ) {
          return { rows: [{ email: CURRENT_EMAIL, email_verified: true }] };
        }
        if (
          statement.includes("select email, email_verified") &&
          statement.includes("for update")
        ) {
          return { rows: [{ email: CURRENT_EMAIL, email_verified: true }] };
        }
        if (
          statement.includes("from account_email_change_requests") &&
          statement.includes("where user_id = $1")
        ) {
          return { rows: [] };
        }
        if (statement.includes("returning request_count")) {
          return { rows: [{ request_count: 1 }] };
        }
        if (statement.includes("insert into account_email_change_requests")) {
          return { rows: [{ generation: 1, id: REQUEST_ID }] };
        }
        return { rows: [], rowCount: 1 };
      },
    });

    await expect(
      createOrRefreshEmailChangeRequest({
        newEmail: " NEW@Example.Test ",
        userId: USER_ID,
      })
    ).resolves.toMatchObject({ status: "pending_current" });

    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client: expect.anything(),
      message: {
        aggregateId: REQUEST_ID,
        aggregateType: "account_email_change",
        idempotencyKey: `auth.email-change-confirmation/${REQUEST_ID}/1/v1`,
        payload: { changeRequestId: REQUEST_ID, generation: 1 },
        payloadVersion: 1,
        topic: "auth.email-change-confirmation",
      },
    });
    const insert = query.mock.calls.find(([sql]) =>
      String(sql).includes("insert into account_email_change_requests")
    );
    expect(insert?.[1]).toEqual([
      expect.any(String),
      USER_ID,
      CURRENT_EMAIL,
      NEW_EMAIL,
      expect.any(Date),
    ]);
    expect(
      JSON.stringify(dependencies.enqueueOutboxMessage.mock.calls)
    ).not.toContain(CURRENT_EMAIL);
    expect(
      JSON.stringify(dependencies.enqueueOutboxMessage.mock.calls)
    ).not.toContain(NEW_EMAIL);
    expect(query).toHaveBeenCalledWith("commit");
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("confirms the current address and sends a new generation to the pending address", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const { initial, query } = createPool({
      initialQuery: () => ({
        rows: [
          {
            current_email: CURRENT_EMAIL,
            new_email: NEW_EMAIL,
            user_id: USER_ID,
          },
        ],
      }),
      transactionQuery: (statement) => {
        if (statement.includes("from account_email_change_requests")) {
          return {
            rows: [
              requestRow({
                expiresAt,
                generation: 1,
                status: "pending_current",
              }),
            ],
          };
        }
        if (
          statement.includes("from users") &&
          statement.includes("for update")
        ) {
          return {
            rows: [{ email: CURRENT_EMAIL, email_verified: true, id: USER_ID }],
          };
        }
        if (statement.includes("update account_email_change_requests")) {
          return { rows: [{ id: REQUEST_ID }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      },
    });

    await expect(
      consumeEmailChangeToken(createToken(expiresAt, 1))
    ).resolves.toEqual({
      nextPath: "/confirmar-troca-email?status=awaiting-new",
    });

    expect(initial).toHaveBeenCalledOnce();
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          idempotencyKey: `auth.email-change-confirmation/${REQUEST_ID}/2/v1`,
          payload: { changeRequestId: REQUEST_ID, generation: 2 },
        }),
      })
    );
    expect(
      query.mock.calls.some(([statement]) =>
        String(statement).includes("update users")
      )
    ).toBe(false);
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("changes the address only after the new address is confirmed, revokes sessions, and notifies both addresses", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const { query } = createPool({
      initialQuery: () => ({
        rows: [
          {
            current_email: CURRENT_EMAIL,
            new_email: NEW_EMAIL,
            user_id: USER_ID,
          },
        ],
      }),
      transactionQuery: (statement) => {
        if (statement.includes("from account_email_change_requests")) {
          return {
            rows: [
              requestRow({
                expiresAt,
                generation: 2,
                status: "pending_new",
              }),
            ],
          };
        }
        if (
          statement.includes("select id") &&
          statement.includes("canonicalize_auth_email_identity(email)")
        ) {
          return { rows: [] };
        }
        if (
          statement.includes("from users") &&
          statement.includes("for update")
        ) {
          return {
            rows: [{ email: CURRENT_EMAIL, email_verified: true, id: USER_ID }],
          };
        }
        if (statement.includes("update users")) {
          return { rows: [], rowCount: 1 };
        }
        if (statement.includes("update account_email_change_requests")) {
          return { rows: [{ id: REQUEST_ID }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      },
    });

    await expect(
      consumeEmailChangeToken(createToken(expiresAt, 2))
    ).resolves.toEqual({ nextPath: "/entrar?emailChanged=1" });

    expect(query).toHaveBeenCalledWith(
      "delete from sessions where user_id = $1",
      [USER_ID]
    );
    expect(
      dependencies.enqueueOutboxMessage.mock.calls.map(
        ([input]) => input.message.payload
      )
    ).toEqual([
      { changeRequestId: REQUEST_ID, recipient: "current" },
      { changeRequestId: REQUEST_ID, recipient: "new" },
    ]);
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("returns the safe completion path when the final confirmation response is retried", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const { query } = createPool({
      initialQuery: () => ({
        rows: [
          {
            current_email: CURRENT_EMAIL,
            new_email: NEW_EMAIL,
            user_id: USER_ID,
          },
        ],
      }),
      transactionQuery: (statement) =>
        statement.includes("from account_email_change_requests")
          ? {
              rows: [
                requestRow({
                  expiresAt,
                  generation: 2,
                  status: "completed",
                }),
              ],
            }
          : { rows: [], rowCount: 1 },
    });

    await expect(
      consumeEmailChangeToken(createToken(expiresAt, 2))
    ).resolves.toEqual({ nextPath: "/entrar?emailChanged=1" });
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("update users"),
      expect.anything()
    );
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("rejects expired tokens before opening a database transaction", async () => {
    const poolConnect = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: poolConnect,
      query: vi.fn(),
    });

    await expect(
      consumeEmailChangeToken(createToken(new Date(Date.now() - 60_000), 1))
    ).resolves.toBeNull();
    expect(poolConnect).not.toHaveBeenCalled();
  });

  it("commits rate-limit increments even when a change request is throttled", async () => {
    const { query } = createPool({
      transactionQuery: (statement) => {
        if (
          statement.includes("from users") &&
          statement.includes("email_verified")
        ) {
          return { rows: [{ email: CURRENT_EMAIL, email_verified: true }] };
        }
        if (
          statement.includes("canonicalize_auth_email_identity(email)") ||
          statement.includes("where user_id = $1 and status in")
        ) {
          return { rows: [] };
        }
        if (statement.includes("returning request_count")) {
          return { rows: [{ request_count: 4 }] };
        }
        return { rows: [], rowCount: 1 };
      },
    });

    await expect(
      createOrRefreshEmailChangeRequest({
        newEmail: NEW_EMAIL,
        userId: USER_ID,
      })
    ).rejects.toThrow("muitas alterações");
    expect(query).toHaveBeenCalledWith("commit");
    expect(query).not.toHaveBeenCalledWith("rollback");
    expect(
      query.mock.calls.some(([statement]) =>
        String(statement).includes("insert into account_email_change_requests")
      )
    ).toBe(false);
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("expires requests and retains terminal addresses while notice emails remain unresolved", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 1 });
    const client = { query } as unknown as PoolClient;

    await expect(expireAccountEmailChangeRequests({ client })).resolves.toEqual(
      { expired: 2, removed: 1 }
    );
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "status in ('pending_current', 'pending_new')"
    );
    expect(String(query.mock.calls[1]?.[0])).toContain("interval '30 days'");
    expect(String(query.mock.calls[1]?.[0])).toContain(
      "message.topic = 'email.email-change-notice'"
    );
  });
});
