"use client";

import {
  Activity03Icon,
  Analytics01Icon,
  Audit01Icon,
  Book01Icon,
  DashboardSquare01Icon,
  Invoice01Icon,
  Settings01Icon,
  StudentIcon,
  TeamWorkIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from "@/components/ui/sidebar";
import type { AuthPermission } from "@/lib/auth-policy";
import { route } from "@/lib/routes";

const adminNavItems = [
  ["Painel", "/admin", DashboardSquare01Icon, "viewAdminPanel"],
  [
    "Aprendizagem",
    "/admin/aprendizagem",
    Analytics01Icon,
    "viewLearningAnalytics",
  ],
  ["Cursos", "/admin/cursos", Book01Icon, "viewCourses"],
  ["Equipe", "/admin/equipe", TeamWorkIcon, "manageStaffAccess"],
  ["Alunos", "/admin/alunos", StudentIcon, "viewStudents"],
  ["Financeiro", "/admin/financeiro", Invoice01Icon, "viewFinancials"],
  ["Operação", "/admin/operacao", Activity03Icon, "viewOperations"],
  ["Auditoria", "/admin/auditoria", Audit01Icon, "viewAudit"],
  ["Configurações", "/admin/configuracoes", Settings01Icon, "viewSettings"],
] as const;

export function AdminSidebarNav({
  permissions,
}: {
  permissions: readonly (AuthPermission | string)[];
}): React.JSX.Element {
  const navItems = adminNavItems.filter(
    ([, , , permission]) =>
      permission === "viewSettings" || permissions.includes(permission)
  );

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map(([label, href, icon]) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuLink href={route(href)} tooltip={label}>
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={icon}
                  size={18}
                  strokeWidth={1.5}
                />
                <span>{label}</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
