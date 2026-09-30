import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailChallengeToken } from "./email-challenge-token";

const dependencies = vi.hoisted(() => ({
  connect: vi.fn(),
  enqueueOutboxMessage: vi.fn(),
  getServerEnv: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ connect: dependencies.connect }),
}));
vi.mock("@/features/outbox/server", () => ({
  enqueueOutboxMessage: dependencies.enqueueOutboxMessage,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));

import {
  consumeAccountEmailChallenge,
  requestPublicAccountRegistration,
} from "./email-challenges";

const SECRET = "test-auth-secret-with-at-least-thirty-two-characters";
const REQUEST_HEADERS = new Headers({
  "x-forwarded-for": "198.51.100.10, 203.0.113.20",
});

const makeClient = (
  handleQuery: (query: string, values: unknown[]) => unknown
) => {
  const query = vi.fn(async (statement: string, values: unknown[] = []) =>
    handleQuery(statement, values)
  );
  return {
    client: { query, release: vi.fn() },
    query,
  };
};

describe("account email challenges", () => {
  beforeEach(() => {
    dependencies.connect.mockReset();
    dependencies.enqueueOutboxMessage.mockReset();
    dependencies.enqueueOutboxMessage.mockResolvedValue({
      id: "outbox-1",
      inserted: true,
    });
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: SECRET,
      CLIENT_IP_SOURCE: "x-forwarded-for",
    });
  });

  it("keeps a public email signup pending and enqueues only challenge identifiers", async () => {
    const pendingSignupId = randomUUID();
    const challengeId = randomUUID();
    const { client, query } = makeClient((statement) => {
      if (
        statement.includes("insert into account_email_challenge_rate_limits")
      ) {
        return { rows: [{ request_count: 1 }] };
      }
      if (
        statement.includes("from users") &&
        statement.includes("canonicalize_auth_email_identity")
      ) {
        return { rows: [] };
      }
      if (
        statement.includes("select id, generation") &&
        statement.includes("from pending_signups")
      ) {
        return { rows: [] };
      }
      if (statement.includes("insert into pending_signups")) {
        return { rows: [{ generation: 1, id: pendingSignupId }] };
      }
      if (statement.includes("insert into account_email_challenges")) {
        return { rows: [{ generation: 1, id: challengeId }] };
      }
      return { rows: [] };
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      requestPublicAccountRegistration({
        input: {
          courseSlug: "curso-teste",
          email: "Student+tag@gmail.com",
          name: "Student Example",
        },
        requestHeaders: REQUEST_HEADERS,
      })
    ).resolves.toBe("queued");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      ["account-email:student@gmail.com"]
    );
    expect(query.mock.calls.flatMap((call) => call[1])).not.toContain(
      "attacker-chosen-password"
    );
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client,
      message: {
        aggregateId: challengeId,
        aggregateType: "account_email_challenge",
        idempotencyKey: `auth.email-verification/${challengeId}/1/v1`,
        payload: { challengeId, generation: 1 },
        payloadVersion: 1,
        topic: "auth.email-verification",
      },
    });
    expect(query).toHaveBeenCalledWith("commit");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("suppresses public signup for a verified account without enqueueing mail", async () => {
    const { client } = makeClient((statement) => {
      if (
        statement.includes("insert into account_email_challenge_rate_limits")
      ) {
        return { rows: [{ request_count: 1 }] };
      }
      if (
        statement.includes("from users") &&
        statement.includes("canonicalize_auth_email_identity")
      ) {
        return {
          rows: [
            {
              email: "student@example.test",
              email_verified: true,
              id: "student-1",
              role: "student",
            },
          ],
        };
      }
      return { rows: [] };
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      requestPublicAccountRegistration({
        input: {
          courseSlug: null,
          email: "student@example.test",
          name: "Attacker Name",
        },
        requestHeaders: REQUEST_HEADERS,
      })
    ).resolves.toBe("suppressed");
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("does not turn an existing Staff account into a public signup claim", async () => {
    const { client } = makeClient((statement) => {
      if (
        statement.includes("insert into account_email_challenge_rate_limits")
      ) {
        return { rows: [{ request_count: 1 }] };
      }
      if (
        statement.includes("from users") &&
        statement.includes("canonicalize_auth_email_identity")
      ) {
        return {
          rows: [
            {
              email: "admin@example.test",
              email_verified: false,
              id: "admin-1",
              role: "admin",
            },
          ],
        };
      }
      return { rows: [] };
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      requestPublicAccountRegistration({
        input: {
          courseSlug: null,
          email: "admin@example.test",
          name: "Attacker Name",
        },
        requestHeaders: REQUEST_HEADERS,
      })
    ).resolves.toBe("suppressed");
    expect(dependencies.enqueueOutboxMessage).not.toHaveBeenCalled();
  });

  it("fails closed in production when no trusted client IP can be resolved", async () => {
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: SECRET,
      CLIENT_IP_SOURCE: "x-forwarded-for",
      NODE_ENV: "production",
    });
    const { client, query } = makeClient((statement) => {
      if (
        statement.includes("insert into account_email_challenge_rate_limits")
      ) {
        return { rows: [{ request_count: 11 }] };
      }
      return { rows: [] };
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(
      requestPublicAccountRegistration({
        input: {
          courseSlug: null,
          email: "student@example.test",
          name: "Student Example",
        },
        requestHeaders: new Headers(),
      })
    ).resolves.toBe("rate_limited");
    expect(
      query.mock.calls.filter(([statement]) =>
        statement.includes("insert into account_email_challenge_rate_limits")
      )
    ).toHaveLength(1);
  });

  it("requires explicit POST consumption and consumes a signup challenge atomically", async () => {
    const challengeId = randomUUID();
    const pendingSignupId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const token = createEmailChallengeToken({
      challengeId,
      expiresAt,
      generation: 2,
      purpose: "signup",
      secret: SECRET,
    });
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from account_email_challenges")) {
        return {
          rows: [
            {
              consumed_at: null,
              expires_at: expiresAt,
              generation: 2,
              id: challengeId,
              owner_email: "student@example.test",
              order_id: null,
              pending_email: null,
              pending_signup_id: pendingSignupId,
              purpose: "signup",
              user_id: null,
            },
          ],
        };
      }
      if (statement.includes("from pending_signups")) {
        return {
          rows: [
            {
              course_slug: "curso-teste",
              email: "student@example.test",
              expires_at: expiresAt,
              generation: 2,
              id: pendingSignupId,
              name: "Student Example",
              status: "pending",
            },
          ],
        };
      }
      if (
        statement.includes("from users") &&
        statement.includes("canonicalize_auth_email_identity")
      ) {
        return { rows: [] };
      }
      if (statement.includes("insert into users")) {
        return { rows: [{ id: "created-student" }] };
      }
      return { rows: [] };
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(consumeAccountEmailChallenge(token)).resolves.toEqual({
      confirmed: true,
      nextPath: "/entrar?returnTo=%2Fcomprar%2Fcurso-teste&emailVerified=1",
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "insert into users (id, name, email, email_verified)"
      ),
      [expect.any(String), "Student Example", "student@example.test"]
    );
    expect(
      query.mock.calls.some(([statement]) => statement.includes("accounts"))
    ).toBe(false);
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("rejects replay without another identity mutation", async () => {
    const challengeId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const token = createEmailChallengeToken({
      challengeId,
      expiresAt,
      generation: 1,
      purpose: "signup",
      secret: SECRET,
    });
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from account_email_challenges")) {
        return {
          rows: [
            {
              consumed_at: new Date(),
              expires_at: expiresAt,
              generation: 1,
              id: challengeId,
              owner_email: "student@example.test",
              order_id: null,
              pending_email: null,
              pending_signup_id: randomUUID(),
              purpose: "signup",
              user_id: null,
            },
          ],
        };
      }
      return { rows: [] };
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(consumeAccountEmailChallenge(token)).resolves.toEqual({
      confirmed: false,
    });
    expect(
      query.mock.calls.some(([statement]) =>
        statement.includes("insert into users")
      )
    ).toBe(false);
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("claims an unverified student account by clearing pre-proof credentials and sessions", async () => {
    const challengeId = randomUUID();
    const userId = "legacy-student-1";
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const token = createEmailChallengeToken({
      challengeId,
      expiresAt,
      generation: 1,
      purpose: "verify_email",
      secret: SECRET,
    });
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from account_email_challenges")) {
        return {
          rows: [
            {
              consumed_at: null,
              expires_at: expiresAt,
              generation: 1,
              id: challengeId,
              owner_email: "legacy@example.test",
              order_id: null,
              pending_email: null,
              pending_signup_id: null,
              purpose: "verify_email",
              user_id: userId,
            },
          ],
        };
      }
      if (
        statement.includes("from users") &&
        statement.includes("email_verified")
      ) {
        return {
          rows: [
            {
              email: "legacy@example.test",
              email_verified: false,
            },
          ],
        };
      }
      return { rows: [] };
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(consumeAccountEmailChallenge(token)).resolves.toEqual({
      confirmed: true,
      nextPath: "/entrar?emailVerified=1",
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("delete from accounts"),
      [userId]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("delete from sessions"),
      [userId]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("set email_verified = true"),
      [userId]
    );
  });

  it("allows an Admin to prove the mailbox without retaining an unproven credential", async () => {
    const challengeId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const token = createEmailChallengeToken({
      challengeId,
      expiresAt,
      generation: 1,
      purpose: "verify_email",
      secret: SECRET,
    });
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from account_email_challenges")) {
        return {
          rows: [
            {
              consumed_at: null,
              expires_at: expiresAt,
              generation: 1,
              id: challengeId,
              owner_email: "admin@example.test",
              order_id: null,
              pending_email: null,
              pending_signup_id: null,
              purpose: "verify_email",
              user_id: "admin-1",
            },
          ],
        };
      }
      if (
        statement.includes("from users") &&
        statement.includes("email_verified")
      ) {
        return {
          rows: [
            {
              email: "admin@example.test",
              email_verified: false,
            },
          ],
        };
      }
      return { rows: [] };
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(consumeAccountEmailChallenge(token)).resolves.toMatchObject({
      confirmed: true,
      nextPath: "/entrar?emailVerified=1",
    });
    expect(
      query.mock.calls.some(([statement]) =>
        statement.includes("delete from accounts")
      )
    ).toBe(true);
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("confirms a purchase challenge and preserves a safe course return", async () => {
    const challengeId = randomUUID();
    const orderId = randomUUID();
    const userId = "purchased-student-1";
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const token = createEmailChallengeToken({
      challengeId,
      expiresAt,
      generation: 1,
      purpose: "purchase_verification",
      secret: SECRET,
    });
    const { client, query } = makeClient((statement) => {
      if (statement.includes("from account_email_challenges")) {
        return {
          rows: [
            {
              consumed_at: null,
              expires_at: expiresAt,
              generation: 1,
              id: challengeId,
              order_id: orderId,
              owner_email: "purchased@example.test",
              pending_email: null,
              pending_signup_id: null,
              purpose: "purchase_verification",
              user_id: userId,
            },
          ],
        };
      }
      if (
        statement.includes("from users") &&
        statement.includes("email_verified")
      ) {
        return {
          rows: [
            {
              email: "purchased@example.test",
              email_verified: false,
            },
          ],
        };
      }
      if (
        statement.includes("from orders") &&
        statement.includes("checkout_course_slug")
      ) {
        return { rows: [{ checkout_course_slug: "curso-comprado" }] };
      }
      return { rows: [] };
    });
    dependencies.connect.mockResolvedValue(client);

    await expect(consumeAccountEmailChallenge(token)).resolves.toEqual({
      confirmed: true,
      nextPath: "/entrar?returnTo=%2Fcomprar%2Fcurso-comprado&emailVerified=1",
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("delete from accounts"),
      [userId]
    );
  });
});
