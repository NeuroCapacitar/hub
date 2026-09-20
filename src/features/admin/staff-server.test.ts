import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));

import { getStaffMembers, getStaffPromotionCandidates } from "./staff-server";

describe("staff read projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requirePermission.mockResolvedValue({
      role: "admin",
      supportPermissionGrants: [],
    });
  });

  it("requires staff access and returns only account access fields", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          email: "support@example.test",
          last_access_at: new Date("2026-09-16T12:00:00.000Z"),
          name: "Suporte",
          role: "support",
          support_permission_grants: ["executeRefund"],
          support_permission_views: ["viewFinancialOrders"],
          user_id: "user-1",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(getStaffMembers()).resolves.toEqual([
      {
        email: "support@example.test",
        lastAccessAt: new Date("2026-09-16T12:00:00.000Z"),
        name: "Suporte",
        role: "support",
        supportPermissionGrants: ["executeRefund"],
        supportPermissionViews: ["viewFinancialOrders"],
        userId: "user-1",
      },
    ]);

    expect(dependencies.requirePermission).toHaveBeenCalledWith(
      "manageStaffAccess"
    );
    const statement = String(query.mock.calls[0]?.[0]);
    expect(statement).toContain("from users u");
    expect(statement).toContain("where p.role in ('admin', 'support')");
    expect(statement).not.toContain("left join sessions s");
    expect(statement).toContain("support_permission_grants");
    expect(statement).not.toContain("accounts");
    expect(statement).not.toContain("password");
    expect(statement).not.toContain("access_token");
    expect(statement).not.toContain("refresh_token");
    expect(statement).not.toContain("id_token");
  });

  it("searches only student accounts as promotion candidates", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          email: "student@example.test",
          name: "Aluno",
          user_id: "student-1",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(getStaffPromotionCandidates("student")).resolves.toEqual({
      candidates: [
        {
          email: "student@example.test",
          name: "Aluno",
          userId: "student-1",
        },
      ],
      hasMore: false,
      search: "student",
    });

    const statement = String(query.mock.calls[0]?.[0]);
    expect(statement).toContain("where p.role = 'student'");
    expect(query.mock.calls[0]?.[1]).toEqual(["%student%", 11]);
  });
});
