import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  getStaffMembers: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("@/features/admin/staff-server", () => ({
  getStaffMembers: dependencies.getStaffMembers,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("@/components/admin/staff-promotion-dialog", () => ({
  StaffPromotionDialog: () => <button type="button">Adicionar à equipe</button>,
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

    const markup = renderToStaticMarkup(await StaffPage());

    expect(markup).toContain("Equipe");
    expect(markup).toContain(
      "Consulte os membros e ajuste as permissões do Suporte."
    );
    expect(markup).toContain("Ver Alunos");
    expect(markup).toContain("Adicionar à equipe");
    expect(markup).toContain("Contas com acesso administrativo");
    expect(markup).toContain('aria-label="Ajuda: Permissões da equipe"');
    expect(markup.indexOf("Adicionar à equipe")).toBeLessThan(
      markup.indexOf("Contas com acesso administrativo")
    );
  });
});
