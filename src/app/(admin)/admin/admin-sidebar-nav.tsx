"use client";

import {
  AccountSetting01Icon,
  Activity03Icon,
  Analytics01Icon,
  Book01Icon,
  HistoryIcon,
  Invoice01Icon,
  UserGroupIcon,
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
  ["Painel", "/admin", Analytics01Icon, "viewAdminPanel"],
  [
    "Aprendizagem",
    "/admin/aprendizagem",
    Analytics01Icon,
    "viewLearningAnalytics",
  ],
  ["Cursos", "/admin/cursos", Book01Icon, "viewCourses"],
  ["Equipe", "/admin/equipe", UserGroupIcon, "manageStaffAccess"],
  ["Alunos", "/admin/alunos", UserGroupIcon, "viewStudents"],
  ["Financeiro", "/admin/financeiro", Invoice01Icon, "viewFinancials"],
  ["Operação", "/admin/operacao", Activity03Icon, "viewOperations"],
  ["Auditoria", "/admin/auditoria", HistoryIcon, "viewAudit"],
  [
    "Configurações",
    "/admin/configuracoes",
    AccountSetting01Icon,
    "viewSettings",
  ],
] as const;

export function AdminSidebarNav({
  permissions,
}: {
  permissions: readonly (AuthPermission | string)[];
}): React.JSX.Element {
  const navItems = adminNavItems.filter(([, , , permission]) =>
    permissions.includes(permission)
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
