import "server-only";
import { getPool } from "@/db";
import { requirePermission } from "@/lib/auth-permissions";
import type { AppRole } from "@/lib/session";
import type {
  SupportPermission,
  SupportViewPermission,
} from "@/lib/support-permissions";
import {
  normalizeSupportPermissionGrants,
  normalizeSupportPermissionViews,
} from "@/lib/support-permissions";

export interface StaffMemberSummary {
  email: string;
  lastAccessAt: Date | null;
  name: string;
  role: AppRole;
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
    role: AppRole;
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
        coalesce(p.last_access_at, max(s.created_at)) as last_access_at
      from users u
      join profiles p on p.user_id = u.id
      left join sessions s on s.user_id = u.id
      group by
        u.id,
        u.name,
        u.email,
        p.role,
        p.support_permission_grants,
        p.support_permission_views,
        p.last_access_at
      order by
        case p.role when 'admin' then 0 when 'support' then 1 else 2 end,
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
