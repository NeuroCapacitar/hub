"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getPool } from "@/db";
import { writeAuditLog } from "@/features/admin/audit-log";
import { parseStaffAccessCommand } from "@/features/admin/staff-command-input";
import { requirePermission } from "@/lib/auth-permissions";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
} from "@/lib/observability";
import type { AppRole } from "@/lib/session";
import {
  normalizeSupportPermissionGrants,
  normalizeSupportPermissionViews,
} from "@/lib/support-permissions";

interface StaffAccessRow {
  role: AppRole;
  support_permission_grants: string[];
  support_permission_views: string[];
  user_id: string;
}

const areGrantsEqual = (
  left: readonly string[],
  right: readonly string[]
): boolean =>
  left.length === right.length &&
  left.every((permission, index) => permission === right[index]);

const areViewsEqual = (
  left: readonly string[],
  right: readonly string[]
): boolean =>
  left.length === right.length &&
  left.every((permission, index) => permission === right[index]);

const revalidateStaffAccess = (): void => {
  revalidatePath("/admin");
  revalidatePath("/admin/equipe");
};

const rollbackStaffAccess = async (client: {
  query: (sql: string, values?: unknown[]) => Promise<unknown>;
}): Promise<void> => {
  try {
    await client.query("rollback");
  } catch {
    // Preserve the original failure if the transaction is already closed.
  }
};

export const changeStaffAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageStaffAccess");
  const command = parseStaffAccessCommand(formData);

  if (command.targetUserId === session.user.id) {
    throw new Error("Você não pode alterar a própria Conta.");
  }

  const correlationId = createCorrelationId(
    (await headers()).get(CORRELATION_ID_HEADER)
  );
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('staff-access-management', 0))"
    );

    const actorResult = await client.query<StaffAccessRow>(
      "select user_id, role, support_permission_grants, support_permission_views from profiles where user_id = $1 for share",
      [session.user.id]
    );
    const actor = actorResult.rows[0];
    if (actor?.role !== "admin") {
      throw new Error("A sessão Admin não é mais válida.");
    }

    const targetResult = await client.query<StaffAccessRow>(
      `
        select user_id, role, support_permission_grants
          , support_permission_views
        from profiles
        where user_id = $1
        for update
      `,
      [command.targetUserId]
    );
    const target = targetResult.rows[0];

    if (!target) {
      throw new Error("A Conta selecionada não foi encontrada.");
    }

    const targetGrants = normalizeSupportPermissionGrants(
      target.support_permission_grants
    );
    const targetViews = normalizeSupportPermissionViews(
      target.support_permission_views
    );
    if (
      target.role !== "support" &&
      (targetGrants.length > 0 || targetViews.length > 0)
    ) {
      throw new Error(
        "O Perfil da Conta está inconsistente; alteração bloqueada."
      );
    }

    if (
      target.role === command.role &&
      areGrantsEqual(targetGrants, command.grants) &&
      areViewsEqual(targetViews, command.views)
    ) {
      throw new Error("A Conta já possui esse papel e essas permissões.");
    }

    if (target.role === "admin" && command.role !== "admin") {
      const adminCountResult = await client.query<{ admin_count: number }>(
        "select count(*)::int as admin_count from profiles where role = 'admin'"
      );
      const adminCount = Number(adminCountResult.rows[0]?.admin_count ?? 0);
      if (adminCount <= 1) {
        throw new Error("A última Conta Admin não pode ser rebaixada.");
      }
    }

    const nextGrants = command.role === "support" ? command.grants : [];
    const nextViews = command.role === "support" ? command.views : [];
    const roleChanged = target.role !== command.role;
    const updateResult = await client.query(
      `
        update profiles
        set role = $2::role,
            support_permission_grants = $3::text[],
            support_permission_views = $4::text[],
            updated_at = now()
        where user_id = $1
      `,
      [command.targetUserId, command.role, nextGrants, nextViews]
    );

    if (updateResult.rowCount !== 1) {
      throw new Error("Não foi possível atualizar a Conta selecionada.");
    }

    if (roleChanged) {
      await client.query("delete from sessions where user_id = $1", [
        command.targetUserId,
      ]);
    }

    await writeAuditLog({
      action: "staff.access_changed",
      actorUserId: session.user.id,
      client,
      metadata: {
        actorRoleSnapshot: actor.role,
        after: { grants: nextGrants, role: command.role, views: nextViews },
        before: { grants: targetGrants, role: target.role, views: targetViews },
        correlationId,
        reason: command.reason,
      },
      targetId: command.targetUserId,
      targetType: "staff",
    });

    await client.query("commit");
    revalidateStaffAccess();
  } catch (error) {
    await rollbackStaffAccess(client);
    throw error;
  } finally {
    client.release();
  }
};
