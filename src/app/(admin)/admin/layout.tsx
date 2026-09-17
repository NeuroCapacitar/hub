import { redirect } from "next/navigation";
import { AdminSidebarNav } from "@/app/(admin)/admin/admin-sidebar-nav";
import { PanelLayout } from "@/components/panel-layout";
import type { AuthPermission } from "@/lib/auth-policy";
import { canPerform, hasAdminSurfaceAccess } from "@/lib/auth-policy";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireSession();
  if (!hasAdminSurfaceAccess(session)) {
    return redirect(route("/app"));
  }
  const navigationPermissions = [
    "viewAdminPanel",
    "viewLearningAnalytics",
    "viewCourses",
    "manageStaffAccess",
    "viewStudents",
    "viewFinancials",
    "viewOperations",
    "viewAudit",
    "viewSettings",
  ] as const satisfies readonly AuthPermission[];
  const visibleNavigationPermissions = navigationPermissions.filter(
    (permission) => canPerform(session, permission)
  );

  return (
    <PanelLayout
      navContent={
        <AdminSidebarNav permissions={visibleNavigationPermissions} />
      }
      userEmail={session.user.email}
      userImage={(session.user as { image?: string | null }).image ?? null}
      userName={session.user.name}
      userRole={session.role}
    >
      {children}
    </PanelLayout>
  );
}
