import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  enqueueOutboxMessage: vi.fn(),
  getPool: vi.fn(),
  getServerEnv: vi.fn(),
  requirePermission: vi.fn(),
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
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: dependencies.getServerEnv,
}));

import { createEmailChallengeToken } from "@/features/account/email-challenge-token";
import {
  acceptStaffInvitation,
  createOrRefreshStaffInvitation,
  expireStaffInvitations,
} from "./staff-invitations";

const INVITATION_ID = "8b5f2d8e-dc4d-43a3-9c1b-35dcac2a2a32";
const TOKEN_SECRET = "test-secret";

const makeDatabase = (
  respond: (statement: string, values: unknown[]) => unknown
): { client: PoolClient; query: ReturnType<typeof vi.fn> } => {
  const query = vi.fn(async (statement: string, values: unknown[] = []) =>
    respond(statement, values)
  );
  const client = {
    query,
    release: vi.fn(),
  } as unknown as PoolClient;
  dependencies.getPool.mockReturnValue({
    connect: vi.fn().mockResolvedValue(client),
  });
  return { client, query };
};

const makeInvite = (expiresAt: Date) => ({
  email: "student@example.test",
  expires_at: expiresAt,
  generation: 3,
  id: INVITATION_ID,
  inviter_user_id: "admin-1",
  reason: "Aprovado para o suporte",
  role: "support" as const,
  status: "pending" as const,
  support_permission_grants: ["manageOperations"],
  support_permission_views: [],
});

const createInviteToken = (expiresAt: Date): string =>
  createEmailChallengeToken({
    challengeId: INVITATION_ID,
    expiresAt,
    generation: 3,
    purpose: "staff_invitation",
    secret: TOKEN_SECRET,
  });

describe("staff invitation lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.enqueueOutboxMessage.mockResolvedValue({
      id: "outbox-invite",
      inserted: true,
    });
    dependencies.requirePermission.mockResolvedValue({
      user: { id: "admin-1" },
    });
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: TOKEN_SECRET,
    });
    dependencies.writeAuditLog.mockResolvedValue(undefined);
    vi.stubEnv("BETTER_AUTH_SECRET", TOKEN_SECRET);
    vi.stubEnv("NODE_ENV", "test");
  });

  it("expires only invitations past their deadline", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 3 });
    await expect(expireStaffInvitations({ client: { query } })).resolves.toBe(
      3
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "where status = 'pending' and expires_at <= now()"
      )
    );
  });

  it("creates the invitation and outbox intent in one transaction without storing token or email in the message", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { query } = makeDatabase((statement) => {
      if (statement.includes("select users.email, users.name, profiles.role")) {
        return {
          rows: [
            {
              email: "owner@example.test",
              name: "Admin Owner",
              role: "admin",
            },
          ],
        };
      }
      if (statement.includes("canonicalize_auth_email_identity(users.email)")) {
        return { rows: [] };
      }
      if (statement.includes("where status = 'pending'")) {
        return { rows: [] };
      }
      if (statement.includes("insert into staff_invitations")) {
        return { rows: [{ generation: 1, id: INVITATION_ID }] };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(
      createOrRefreshStaffInvitation({
        actorUserId: "admin-1",
        input: {
          email: "student@example.test",
          grants: ["manageOperations"],
          reason: "Aprovado para o suporte",
          role: "support",
          views: [],
        },
      })
    ).resolves.toMatchObject({
      invitationId: INVITATION_ID,
      outcome: "created",
    });

    expect(query).toHaveBeenCalledWith("begin");
    expect(query).toHaveBeenCalledWith("commit");
    expect(dependencies.enqueueOutboxMessage).toHaveBeenCalledWith({
      client: expect.anything(),
      message: {
        aggregateId: INVITATION_ID,
        aggregateType: "staff_invitation",
        idempotencyKey: `auth.staff-invitation/${INVITATION_ID}/1/v1`,
        payload: { generation: 1, invitationId: INVITATION_ID },
        payloadVersion: 1,
        topic: "auth.staff-invitation",
      },
    });
    expect(
      JSON.stringify(dependencies.enqueueOutboxMessage.mock.calls)
    ).not.toContain("student@example.test");
    expect(
      JSON.stringify(dependencies.enqueueOutboxMessage.mock.calls)
    ).not.toContain(TOKEN_SECRET);
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "staff.invitation_created",
        metadata: expect.not.objectContaining({ email: expect.anything() }),
      })
    );
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("accepts a valid invitation, claims an unverified Student safely and creates no session", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const invitation = makeInvite(expiresAt);
    const statements: string[] = [];
    const { query } = makeDatabase((statement) => {
      statements.push(statement);
      if (
        statement ===
        "select email from staff_invitations where id = $1 limit 1"
      ) {
        return { rows: [{ email: invitation.email }] };
      }
      if (statement.includes("canonicalize_auth_email_identity(users.email)")) {
        return {
          rows: [
            {
              email_verified: false,
              id: "student-1",
              name: "Student",
              platform_blocked_at: null,
              role: "student",
            },
          ],
        };
      }
      if (
        statement.includes("from staff_invitations") &&
        statement.includes("for update")
      ) {
        return { rows: [invitation] };
      }
      if (statement.includes("select profiles.role, users.email_verified")) {
        return { rows: [{ email_verified: true, role: "admin" }] };
      }
      if (statement.includes("select role, platform_blocked_at")) {
        return { rows: [{ platform_blocked_at: null, role: "student" }] };
      }
      if (statement.includes("update profiles")) {
        return { rows: [], rowCount: 1 };
      }
      if (statement.includes("update staff_invitations")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(
      acceptStaffInvitation({
        name: "",
        token: createInviteToken(expiresAt),
      })
    ).resolves.toEqual({ nextPath: "/entrar?returnTo=%2Fadmin" });

    expect(statements.some((sql) => sql.includes("delete from accounts"))).toBe(
      true
    );
    expect(statements.some((sql) => sql.includes("delete from sessions"))).toBe(
      true
    );
    expect(
      statements.some((sql) => sql.includes("email_verified = true"))
    ).toBe(true);
    expect(statements.some((sql) => sql.includes("insert into sessions"))).toBe(
      false
    );
    expect(statements.some((sql) => sql.includes("insert into accounts"))).toBe(
      false
    );
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("creates a verified team account only after invitation acceptance, without credentials or a session", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const invitation = makeInvite(expiresAt);
    const statements: string[] = [];
    const { query } = makeDatabase((statement) => {
      statements.push(statement);
      if (
        statement ===
        "select email from staff_invitations where id = $1 limit 1"
      ) {
        return { rows: [{ email: invitation.email }] };
      }
      if (statement.includes("canonicalize_auth_email_identity(users.email)")) {
        return { rows: [] };
      }
      if (
        statement.includes("from staff_invitations") &&
        statement.includes("for update")
      ) {
        return { rows: [invitation] };
      }
      if (statement.includes("select profiles.role, users.email_verified")) {
        return { rows: [{ email_verified: true, role: "admin" }] };
      }
      if (statement.includes("insert into users")) {
        return { rows: [{ id: "new-staff-user" }] };
      }
      if (statement.includes("select role, platform_blocked_at")) {
        return { rows: [{ platform_blocked_at: null, role: "student" }] };
      }
      if (
        statement.includes("update profiles") ||
        statement.includes("update staff_invitations")
      ) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(
      acceptStaffInvitation({
        name: "New Staff",
        token: createInviteToken(expiresAt),
      })
    ).resolves.toEqual({ nextPath: "/entrar?returnTo=%2Fadmin" });

    expect(
      query.mock.calls.find(([statement]) =>
        String(statement).includes("insert into users")
      )?.[1]
    ).toEqual([expect.any(String), "New Staff", invitation.email]);
    expect(
      statements.some((sql) => sql.includes("email_verified = true"))
    ).toBe(false);
    expect(statements.some((sql) => sql.includes("insert into accounts"))).toBe(
      false
    );
    expect(statements.some((sql) => sql.includes("insert into sessions"))).toBe(
      false
    );
    expect(query).toHaveBeenCalledWith("commit");
  });

  it("rejects an expired signed invite before connecting to the database", async () => {
    const expiredAt = new Date(Date.now() - 60_000);
    const poolConnect = vi.fn();
    dependencies.getPool.mockReturnValue({ connect: poolConnect });

    await expect(
      acceptStaffInvitation({
        name: "New Staff",
        token: createInviteToken(expiredAt),
      })
    ).resolves.toBeNull();
    expect(poolConnect).not.toHaveBeenCalled();
  });

  it("rejects a blocked Student claim before deleting credentials or verifying the address", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const invitation = makeInvite(expiresAt);
    const statements: string[] = [];
    const { query } = makeDatabase((statement) => {
      statements.push(statement);
      if (
        statement ===
        "select email from staff_invitations where id = $1 limit 1"
      ) {
        return { rows: [{ email: invitation.email }] };
      }
      if (statement.includes("canonicalize_auth_email_identity(users.email)")) {
        return {
          rows: [
            {
              email_verified: false,
              id: "student-1",
              name: "Student",
              platform_blocked_at: new Date(),
              role: "student",
            },
          ],
        };
      }
      if (statement.includes("select * from staff_invitations")) {
        return { rows: [invitation] };
      }
      if (statement.includes("select profiles.role, users.email_verified")) {
        return { rows: [{ email_verified: true, role: "admin" }] };
      }
      if (statement.includes("select role, platform_blocked_at")) {
        return { rows: [{ platform_blocked_at: new Date(), role: "student" }] };
      }
      return { rows: [], rowCount: 1 };
    });

    await expect(
      acceptStaffInvitation({
        name: "",
        token: createInviteToken(expiresAt),
      })
    ).resolves.toBeNull();

    expect(statements.some((sql) => sql.includes("delete from accounts"))).toBe(
      false
    );
    expect(
      statements.some((sql) => sql.includes("email_verified = true"))
    ).toBe(false);
    expect(query).toHaveBeenCalledWith("commit");
    expect(query).not.toHaveBeenCalledWith("rollback");
  });
});
