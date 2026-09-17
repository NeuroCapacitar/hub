import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebarNav } from "./admin-sidebar-nav";

const renderNav = (permissions: readonly string[]): string =>
  renderToStaticMarkup(
    <SidebarProvider>
      <AdminSidebarNav permissions={permissions} />
    </SidebarProvider>
  );

const ALL_NAV_PERMISSIONS = [
  "viewAdminPanel",
  "viewLearningAnalytics",
  "viewCourses",
  "viewStudents",
  "viewFinancials",
  "viewOperations",
  "viewAudit",
  "viewSettings",
  "manageStaffAccess",
];

describe("AdminSidebarNav", () => {
  it("shows Support the shared read surfaces and Team with its capability", () => {
    const markup = renderNav(ALL_NAV_PERMISSIONS);

    for (const href of [
      "/admin",
      "/admin/aprendizagem",
      "/admin/cursos",
      "/admin/alunos",
      "/admin/financeiro",
      "/admin/operacao",
      "/admin/auditoria",
      "/admin/configuracoes",
      "/admin/equipe",
    ]) {
      expect(markup).toContain(`href="${href}"`);
    }
    expect(markup.indexOf("/admin/equipe")).toBeLessThan(
      markup.indexOf("/admin/alunos")
    );
  });

  it("does not show Team without the management capability", () => {
    const markup = renderNav(["viewAdminPanel", "viewCourses"]);

    expect(markup).toContain('href="/admin"');
    expect(markup).toContain('href="/admin/cursos"');
    expect(markup).not.toContain('href="/admin/equipe"');
  });
});
