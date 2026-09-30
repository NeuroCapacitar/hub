import "server-only";
import { getPool } from "@/db";
import { requirePermission } from "@/lib/auth-permissions";
import type {
  SupportPermission,
  SupportViewPermission,
} from "@/lib/support-permissions";
import {
  normalizeSupportPermissionGrants,
  normalizeSupportPermissionViews,
} from "@/lib/support-permissions";
import type { StaffRole } from "./staff-command-input";

export interface StaffMemberSummary {
  email: string;
  lastAccessAt: Date | null;
  name: string;
  role: StaffRole;
  supportPermissionGrants: SupportPermission[];
  supportPermissionViews: SupportViewPermission[];
  userId: string;
}

export const getStaffMembers = async (): Promise<StaffMemberSummary[]> => {
  await requirePermission("manageStaffAccess");

  const { rows } = await getPool().query<{
    email: string;
    last_access_at: Date | null;
    name: string;
    role: StaffRole;
    support_permission_grants: string[];
    support_permission_views: string[];
    user_id: string;
  }>(
    `
      select
        u.id as user_id,
        u.name,
        u.email,
        p.role,
        p.support_permission_grants,
        p.support_permission_views,
        p.last_access_at
      from users u
      join profiles p on p.user_id = u.id
      where p.role in ('admin', 'support')
      order by
        case p.role when 'admin' then 0 else 1 end,
        lower(u.name),
        u.id
    `
  );

  return rows.map((row) => ({
    email: row.email,
    lastAccessAt: row.last_access_at,
    name: row.name,
    role: row.role,
    supportPermissionGrants: normalizeSupportPermissionGrants(
      row.support_permission_grants
    ),
    supportPermissionViews: normalizeSupportPermissionViews(
      row.support_permission_views
    ),
    userId: row.user_id,
  }));
};
