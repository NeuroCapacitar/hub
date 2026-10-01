import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  getStaffInvitations: vi.fn(),
  getStaffMembers: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/features/admin/staff-server", () => ({
  getStaffMembers: dependencies.getStaffMembers,
}));
vi.mock("@/features/admin/staff-invitations", () => ({
  getStaffInvitations: dependencies.getStaffInvitations,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("@/components/admin/staff-invitation-dialog", () => ({
  StaffInvitationDialog: () => (
    <button type="button">Convidar para a equipe</button>
  ),
}));
vi.mock("@/components/admin/staff-invitation-list", () => ({
  StaffInvitationList: () => <div>Lista de convites</div>,
}));
vi.mock("@/components/admin/finance-help", () => ({
  FinanceHelp: ({ title }: { title: string }) => (
    <button aria-label={`Ajuda: ${title}`} type="button" />
  ),
}));
vi.mock("./staff-access-table", () => ({
  StaffAccessTable: () => (
    <table>
      <caption>Membros da equipe e respectivos níveis de acesso</caption>
    </table>
  ),
}));

import StaffPage from "./page";

describe("StaffPage", () => {
  it("uses one page header for context and keeps management actions there", async () => {
    dependencies.requirePermission.mockResolvedValue({
      role: "admin",
      user: { id: "admin-1" },
    });
    dependencies.getStaffMembers.mockResolvedValue([]);
    dependencies.getStaffInvitations.mockResolvedValue([]);

    const markup = renderToStaticMarkup(await StaffPage());

    expect(markup).toContain("Equipe");
    expect(markup).toContain(
      "Consulte os membros e ajuste as permissões do Suporte."
    );
    expect(markup).toContain("Ver Alunos");
    expect(markup).toContain("Convidar para a equipe");
    expect(markup).toContain("Convites");
    expect(markup).toContain("Lista de convites");
    expect(markup).toContain("Contas com acesso administrativo");
    expect(markup).toContain('aria-label="Ajuda: Permissões da equipe"');
    expect(markup.indexOf("Convidar para a equipe")).toBeLessThan(
      markup.indexOf("Contas com acesso administrativo")
    );
  });
});
