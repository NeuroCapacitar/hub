import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  headers: vi.fn(),
  revalidatePath: vi.fn(),
  requirePermission: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: dependencies.revalidatePath,
}));
vi.mock("next/headers", () => ({ headers: dependencies.headers }));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/admin/audit-log", () => ({
  writeAuditLog: dependencies.writeAuditLog,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));

import { changeStaffAccessAction } from "./staff-actions";

const createFormData = (
  values: Record<string, string | readonly string[]>
): FormData => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") {
      formData.set(key, value);
    } else {
      for (const item of value) {
        formData.append(key, item);
      }
    }
  }
  return formData;
};

const adminSession = {
  role: "admin" as const,
  supportPermissionGrants: [],
  supportPermissionViews: [],
  user: { id: "actor-1" },
};

const CREDENTIAL_FIELD_PATTERN =
  /accounts|password|access_token|refresh_token|id_token/i;

const createClient = ({
  adminCount = 2,
  target = {
    role: "student" as const,
    support_permission_grants: [],
    support_permission_views: [],
    user_id: "target-1",
  },
}: {
  adminCount?: number;
  target?: {
    role: "admin" | "student" | "support";
    support_permission_grants: string[];
    support_permission_views: string[];
    user_id: string;
  };
} = {}) => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const query = vi.fn((sql: string, values?: unknown[]) => {
    calls.push({ sql, ...(values ? { values } : {}) });
    const normalized = sql.toLowerCase();
    if (normalized.includes("for share")) {
      return Promise.resolve({
        rows: [
          {
            role: "admin",
            support_permission_grants: [],
            support_permission_views: [],
            user_id: "actor-1",
          },
        ],
      });
    }
    if (normalized.includes("count(*)::int as admin_count")) {
      return Promise.resolve({ rows: [{ admin_count: adminCount }] });
    }
    if (normalized.includes("from profiles")) {
      return Promise.resolve({ rows: [target] });
    }
    if (normalized.includes("update profiles")) {
      return Promise.resolve({ rowCount: 1, rows: [] });
    }
    return Promise.resolve({ rowCount: 1, rows: [] });
  });
  const client = { query, release: vi.fn() };
  dependencies.getPool.mockReturnValue({
    connect: vi.fn().mockResolvedValue(client),
  });
  return { calls, client, query };
};

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.requirePermission.mockResolvedValue(adminSession);
  dependencies.headers.mockResolvedValue({ get: () => null });
  dependencies.writeAuditLog.mockResolvedValue(undefined);
});

describe("staff access mutation", () => {
  it("changes role and grants atomically, revokes role-change sessions, and audits", async () => {
    const { calls, client } = createClient();

    await expect(
      changeStaffAccessAction(
        createFormData({
          reason: "Promoção para atendimento operacional",
          role: "support",
          supportPermissionGrants: ["executeRefund", "manageEnrollmentSupport"],
          supportPermissionViews: ["viewFinancialOrders"],
          targetUserId: "target-1",
        })
      )
    ).resolves.toBeUndefined();

    expect(calls.map(({ sql }) => sql.toLowerCase())).toEqual([
      "begin",
      "select pg_advisory_xact_lock(hashtextextended('staff-access-management', 0))",
      expect.stringContaining("for share"),
      expect.stringContaining("for update"),
      expect.stringContaining("update profiles"),
      "delete from sessions where user_id = $1",
      "commit",
    ]);
    expect(calls[4]?.values).toEqual([
      "target-1",
      "support",
      ["manageEnrollmentSupport", "executeRefund"],
      ["viewFinancialOrders"],
    ]);
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith({
      action: "staff.access_changed",
      actorUserId: "actor-1",
      client,
      metadata: expect.objectContaining({
        actorRoleSnapshot: "admin",
        after: {
          grants: ["manageEnrollmentSupport", "executeRefund"],
          role: "support",
          views: ["viewFinancialOrders"],
        },
        before: { grants: [], role: "student", views: [] },
        correlationId: expect.any(String),
        reason: "Promoção para atendimento operacional",
      }),
      targetId: "target-1",
      targetType: "staff",
    });
    const metadata = dependencies.writeAuditLog.mock.calls[0]?.[0].metadata;
    expect(Object.keys(metadata)).toEqual([
      "actorRoleSnapshot",
      "after",
      "before",
      "correlationId",
      "reason",
    ]);
    expect(calls.every(({ sql }) => !CREDENTIAL_FIELD_PATTERN.test(sql))).toBe(
      true
    );
    expect(client.release).toHaveBeenCalledOnce();
    expect(dependencies.revalidatePath).toHaveBeenCalledWith("/admin/equipe");
  });

  it("changes grants without revoking a still-authenticated role session", async () => {
    const { calls } = createClient({
      target: {
        role: "support",
        support_permission_grants: ["executeRefund"],
        support_permission_views: [],
        user_id: "target-1",
      },
    });

    await changeStaffAccessAction(
      createFormData({
        reason: "Retirada do reembolso",
        role: "support",
        supportPermissionGrants: [],
        supportPermissionViews: ["viewFinancialOrders"],
        targetUserId: "target-1",
      })
    );

    expect(calls.map(({ sql }) => sql.toLowerCase())).not.toContain(
      "delete from sessions where user_id = $1"
    );
    expect(calls.at(-1)?.sql).toBe("commit");
  });

  it("refuses to demote the last Admin inside the protected transaction", async () => {
    const { calls, client, query } = createClient({
      adminCount: 1,
      target: {
        role: "admin",
        support_permission_grants: [],
        support_permission_views: [],
        user_id: "target-1",
      },
    });

    await expect(
      changeStaffAccessAction(
        createFormData({
          reason: "Revisão de privilégio",
          role: "support",
          supportPermissionGrants: [],
          targetUserId: "target-1",
        })
      )
    ).rejects.toThrow("última Conta Admin");

    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("update profiles"),
      expect.anything()
    );
    expect(dependencies.writeAuditLog).not.toHaveBeenCalled();
    expect(calls.at(-1)?.sql).toBe("rollback");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rejects self-change before opening a database transaction", async () => {
    const connect = vi.fn();
    dependencies.getPool.mockReturnValue({ connect });

    await expect(
      changeStaffAccessAction(
        createFormData({
          reason: "Tentativa inválida",
          role: "support",
          supportPermissionGrants: [],
          targetUserId: "actor-1",
        })
      )
    ).rejects.toThrow("própria Conta");

    expect(connect).not.toHaveBeenCalled();
  });

  it("fails closed when a non-Support target has grants", async () => {
    const { calls, query } = createClient({
      target: {
        role: "student",
        support_permission_grants: ["executeRefund"],
        support_permission_views: [],
        user_id: "target-1",
      },
    });

    await expect(
      changeStaffAccessAction(
        createFormData({
          reason: "Corrigir perfil inconsistente",
          role: "student",
          supportPermissionGrants: [],
          targetUserId: "target-1",
        })
      )
    ).rejects.toThrow("inconsistente");

    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("update profiles"),
      expect.anything()
    );
    expect(calls.at(-1)?.sql).toBe("rollback");
  });

  it("does not accept invalid command values before opening a transaction", async () => {
    const connect = vi.fn();
    dependencies.getPool.mockReturnValue({ connect });

    await expect(
      changeStaffAccessAction(
        createFormData({
          reason: "",
          role: "support",
          supportPermissionGrants: [],
          targetUserId: "target-1",
        })
      )
    ).rejects.toThrow("motivo");

    expect(connect).not.toHaveBeenCalled();
  });
});
