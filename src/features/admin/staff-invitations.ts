import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import {
  createEmailChallengeToken,
  verifyEmailChallengeToken,
} from "@/features/account/email-challenge-token";
import { writeAuditLog } from "@/features/admin/audit-log";
import { createStaffInvitationMessage } from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";
import { requirePermission } from "@/lib/auth-permissions";
import { normalizeBuyerEmail } from "@/lib/email-identity";
import { getServerEnv } from "@/lib/env";
import type {
  SupportPermission,
  SupportViewPermission,
} from "@/lib/support-permissions";
import type {
  StaffInvitationInput,
  StaffInvitationRole,
} from "./staff-invitation-input";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITATION_TOKEN_LENGTH = 512;

interface InvitationRow {
  accepted_by_user_id?: string | null;
  email: string;
  expires_at: Date;
  generation: number;
  id: string;
  inviter_user_id: string | null;
  reason: string;
  role: StaffInvitationRole;
  status: "accepted" | "expired" | "pending" | "revoked";
  support_permission_grants: string[];
  support_permission_views: string[];
}

interface IdentityRow {
  email_verified: boolean;
  id: string;
  name: string;
  platform_blocked_at: Date | null;
  role: "admin" | "student" | "support" | null;
}

interface InviteClaims {
  expiresAt: Date;
  generation: number;
  invitationId: string;
}

const withTransaction = async <Result>(
  operation: (client: PoolClient) => Promise<Result>
): Promise<Result> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original failure if the transaction was already closed.
    }
    throw error;
  } finally {
    client.release();
  }
};

const lockEmailIdentity = async (
  client: Pick<PoolClient, "query">,
  email: string
): Promise<string> => {
  const canonicalEmail = normalizeBuyerEmail(email);
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `account-email:${canonicalEmail}`,
  ]);
  return canonicalEmail;
};

const requireActiveAdmin = async (
  client: Pick<PoolClient, "query">,
  actorUserId: string
): Promise<{ email: string; name: string }> => {
  const result = await client.query<{
    email: string;
    name: string;
    role: string;
  }>(
    `select users.email, users.name, profiles.role
     from users
     join profiles on profiles.user_id = users.id
     where users.id = $1
       and users.email_verified = true
       and profiles.platform_blocked_at is null
     limit 1
     for share of users, profiles`,
    [actorUserId]
  );
  const actor = result.rows[0];
  if (actor?.role !== "admin") {
    throw new Error("A sessão Admin não é mais válida.");
  }
  return { email: actor.email, name: actor.name };
};

const getCanonicalIdentity = async (
  client: Pick<PoolClient, "query">,
  canonicalEmail: string
): Promise<IdentityRow | null> => {
  const result = await client.query<IdentityRow>(
    `select users.id, users.name, users.email_verified,
            profiles.role, profiles.platform_blocked_at
     from users
     left join profiles on profiles.user_id = users.id
     where public.canonicalize_auth_email_identity(users.email) = $1
     limit 2
     for update of users`,
    [canonicalEmail]
  );
  if (result.rows.length > 1) {
    throw new Error("A identidade do e-mail está ambígua; convite bloqueado.");
  }
  return result.rows[0] ?? null;
};

const supersedeInvitationMessages = async ({
  actorUserId,
  client,
  invitationId,
}: {
  actorUserId: string;
  client: PoolClient;
  invitationId: string;
}): Promise<void> => {
  const result = await client.query<{ id: string }>(
    `update outbox_messages
     set status = 'superseded',
         superseded_at = now(),
         delivered_at = null,
         locked_at = null,
         locked_by = null,
         last_error_code = 'staff_invitation_generation_rotated',
         last_error_at = now(),
         updated_at = now()
     where aggregate_type = 'staff_invitation'
       and aggregate_id = $1
       and topic = 'auth.staff-invitation'
       and status in ('pending', 'retrying', 'dead_letter')
     returning id`,
    [invitationId]
  );
  for (const message of result.rows) {
    await writeAuditLog({
      action: "outbox.superseded",
      actorUserId,
      client,
      metadata: { reason: "staff_invitation_generation_rotated" },
      targetId: message.id,
      targetType: "outbox_message",
    });
  }
};

const queueInvitationEmail = async ({
  client,
  generation,
  invitationId,
}: {
  client: PoolClient;
  generation: number;
  invitationId: string;
}): Promise<void> => {
  await enqueueOutboxMessage({
    client,
    message: createStaffInvitationMessage({ generation, invitationId }),
  });
};

const assertStaffInvitationTarget = ({
  actorEmail,
  canonicalEmail,
  identity,
}: {
  actorEmail: string;
  canonicalEmail: string;
  identity: IdentityRow | null;
}): void => {
  if (normalizeBuyerEmail(actorEmail) === canonicalEmail) {
    throw new Error("Você não pode convidar sua própria Conta.");
  }
  if (identity?.role === "admin" || identity?.role === "support") {
    throw new Error("Esta Conta já faz parte da equipe.");
  }
  if (identity && identity.role !== "student") {
    throw new Error("O Perfil da Conta está inconsistente; convite bloqueado.");
  }
  if (identity?.platform_blocked_at) {
    throw new Error("Uma Conta bloqueada não pode receber convite de equipe.");
  }
};

const saveStaffInvitationRecord = async ({
  actorUserId,
  canonicalEmail,
  client,
  expiresAt,
  invitationEmail,
  input,
}: {
  actorUserId: string;
  canonicalEmail: string;
  client: PoolClient;
  expiresAt: Date;
  invitationEmail: string;
  input: StaffInvitationInput;
}): Promise<{
  generation: number;
  invitationId: string;
  outcome: "created" | "updated";
}> => {
  const existingResult = await client.query<InvitationRow>(
    `select * from staff_invitations
     where status = 'pending'
       and public.canonicalize_auth_email_identity(email) = $1
     limit 1
     for update`,
    [canonicalEmail]
  );
  const existing = existingResult.rows[0];
  if (existing) {
    const updated = await client.query<{ generation: number; id: string }>(
      `update staff_invitations
       set email = $2,
           role = $3::role,
           support_permission_grants = $4::text[],
           support_permission_views = $5::text[],
           inviter_user_id = $6,
           reason = $7,
           generation = generation + 1,
           expires_at = $8,
           updated_at = now()
       where id = $1 and status = 'pending'
       returning id, generation`,
      [
        existing.id,
        invitationEmail,
        input.role,
        input.grants,
        input.views,
        actorUserId,
        input.reason,
        expiresAt,
      ]
    );
    const row = updated.rows[0];
    if (!row) {
      throw new Error("Não foi possível atualizar o convite.");
    }
    return {
      generation: row.generation,
      invitationId: row.id,
      outcome: "updated",
    };
  }

  const inserted = await client.query<{ generation: number; id: string }>(
    `insert into staff_invitations (
       id, email, role, support_permission_grants,
       support_permission_views, inviter_user_id, reason, generation, expires_at
     ) values ($1, $2, $3::role, $4::text[], $5::text[], $6, $7, 1, $8)
     returning id, generation`,
    [
      randomUUID(),
      invitationEmail,
      input.role,
      input.grants,
      input.views,
      actorUserId,
      input.reason,
      expiresAt,
    ]
  );
  const row = inserted.rows[0];
  if (!row) {
    throw new Error("Não foi possível criar o convite.");
  }
  return {
    generation: row.generation,
    invitationId: row.id,
    outcome: "created",
  };
};

export interface StaffInvitationSummary {
  email: string;
  expiresAt: Date;
  generation: number;
  id: string;
  invitedAt: Date;
  inviterName: string;
  reason: string;
  role: StaffInvitationRole;
  status: "expired" | "pending";
  supportPermissionGrants: SupportPermission[];
  supportPermissionViews: SupportViewPermission[];
}

export const getStaffInvitations = async (): Promise<
  StaffInvitationSummary[]
> => {
  await requirePermission("manageStaffAccess");
  const result = await getPool().query<{
    email: string;
    expires_at: Date;
    generation: number;
    id: string;
    invited_at: Date;
    inviter_name: string | null;
    reason: string;
    role: StaffInvitationRole;
    status: "expired" | "pending";
    support_permission_grants: SupportPermission[];
    support_permission_views: SupportViewPermission[];
  }>(
    `select
       invitation.id,
       invitation.email,
       invitation.role,
       invitation.support_permission_grants,
       invitation.support_permission_views,
       invitation.reason,
       invitation.generation,
       invitation.status,
       invitation.expires_at,
       invitation.created_at as invited_at,
       coalesce(inviter.name, 'Equipe NeuroCapacitar') as inviter_name
     from staff_invitations as invitation
     left join users as inviter on inviter.id = invitation.inviter_user_id
     where invitation.status in ('pending', 'expired')
     order by invitation.created_at desc, invitation.id
     limit 50`
  );
  return result.rows.map((row) => ({
    email: row.email,
    expiresAt: row.expires_at,
    generation: row.generation,
    id: row.id,
    invitedAt: row.invited_at,
    inviterName: row.inviter_name ?? "Equipe NeuroCapacitar",
    reason: row.reason,
    role: row.role,
    status:
      row.status === "pending" && row.expires_at.getTime() <= Date.now()
        ? "expired"
        : row.status,
    supportPermissionGrants: row.support_permission_grants,
    supportPermissionViews: row.support_permission_views,
  }));
};

export const createOrRefreshStaffInvitation = async ({
  actorUserId,
  input,
}: {
  actorUserId: string;
  input: StaffInvitationInput;
}): Promise<{
  expiresAt: Date;
  invitationId: string;
  outcome: "created" | "updated";
}> =>
  await withTransaction(async (client) => {
    const actor = await requireActiveAdmin(client, actorUserId);
    const invitationEmail = input.email.trim().toLowerCase();
    const canonicalEmail = await lockEmailIdentity(client, invitationEmail);
    const identity = await getCanonicalIdentity(client, canonicalEmail);
    assertStaffInvitationTarget({
      actorEmail: actor.email,
      canonicalEmail,
      identity,
    });
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const saved = await saveStaffInvitationRecord({
      actorUserId,
      canonicalEmail,
      client,
      expiresAt,
      input,
      invitationEmail,
    });
    if (saved.outcome === "updated") {
      await supersedeInvitationMessages({
        actorUserId,
        client,
        invitationId: saved.invitationId,
      });
    }
    await queueInvitationEmail({
      client,
      generation: saved.generation,
      invitationId: saved.invitationId,
    });
    await writeAuditLog({
      action:
        saved.outcome === "created"
          ? "staff.invitation_created"
          : "staff.invitation_updated",
      actorUserId,
      client,
      metadata: {
        reason: input.reason,
        role: input.role,
        supportPermissionGrants: input.grants,
        supportPermissionViews: input.views,
      },
      targetId: saved.invitationId,
      targetType: "staff_invitation",
    });
    return {
      expiresAt,
      invitationId: saved.invitationId,
      outcome: saved.outcome,
    };
  });

export const resendStaffInvitation = async ({
  actorUserId,
  invitationId,
}: {
  actorUserId: string;
  invitationId: string;
}): Promise<void> =>
  await withTransaction(async (client) => {
    await requireActiveAdmin(client, actorUserId);
    const preview = await client.query<{ email: string }>(
      "select email from staff_invitations where id = $1 limit 1",
      [invitationId]
    );
    const email = preview.rows[0]?.email;
    if (!email) {
      throw new Error("Convite não encontrado.");
    }
    await lockEmailIdentity(client, email);
    const current = await client.query<InvitationRow>(
      `select * from staff_invitations
       where id = $1 and status in ('pending', 'expired')
       limit 1
       for update`,
      [invitationId]
    );
    const invitation = current.rows[0];
    if (!invitation) {
      throw new Error("Este convite não pode mais ser reenviado.");
    }
    const identity = await getCanonicalIdentity(
      client,
      normalizeBuyerEmail(invitation.email)
    );
    if (
      identity?.role === "admin" ||
      identity?.role === "support" ||
      identity?.platform_blocked_at
    ) {
      throw new Error("A Conta não pode receber este convite.");
    }
    const otherPending = await client.query<{ id: string }>(
      `select id from staff_invitations
       where id <> $1
         and status = 'pending'
         and public.canonicalize_auth_email_identity(email) =
           public.canonicalize_auth_email_identity($2)
       limit 1`,
      [invitationId, invitation.email]
    );
    if (otherPending.rows.length > 0) {
      throw new Error("Já existe outro convite pendente para este e-mail.");
    }
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const updated = await client.query<{ generation: number }>(
      `update staff_invitations
       set status = 'pending',
           inviter_user_id = $2,
           generation = generation + 1,
           expires_at = $3,
           updated_at = now()
       where id = $1
       returning generation`,
      [invitationId, actorUserId, expiresAt]
    );
    const generation = updated.rows[0]?.generation;
    if (!generation) {
      throw new Error("Não foi possível atualizar o convite.");
    }
    await supersedeInvitationMessages({ actorUserId, client, invitationId });
    await queueInvitationEmail({ client, generation, invitationId });
    await writeAuditLog({
      action: "staff.invitation_resent",
      actorUserId,
      client,
      metadata: { role: invitation.role },
      targetId: invitationId,
      targetType: "staff_invitation",
    });
  });

export const revokeStaffInvitation = async ({
  actorUserId,
  invitationId,
}: {
  actorUserId: string;
  invitationId: string;
}): Promise<void> =>
  await withTransaction(async (client) => {
    await requireActiveAdmin(client, actorUserId);
    const preview = await client.query<{ email: string }>(
      "select email from staff_invitations where id = $1 limit 1",
      [invitationId]
    );
    const email = preview.rows[0]?.email;
    if (!email) {
      throw new Error("Convite não encontrado.");
    }
    await lockEmailIdentity(client, email);
    const updated = await client.query<{ role: StaffInvitationRole }>(
      `update staff_invitations
       set status = 'revoked',
           revoked_at = now(),
           revoked_by_user_id = $2,
           updated_at = now()
       where id = $1 and status = 'pending'
       returning role`,
      [invitationId, actorUserId]
    );
    const invitation = updated.rows[0];
    if (!invitation) {
      throw new Error("Este convite não está mais pendente.");
    }
    await supersedeInvitationMessages({ actorUserId, client, invitationId });
    await writeAuditLog({
      action: "staff.invitation_revoked",
      actorUserId,
      client,
      metadata: { role: invitation.role },
      targetId: invitationId,
      targetType: "staff_invitation",
    });
  });

const parseStaffInvitationClaims = (token: string): InviteClaims | null => {
  if (token.length > MAX_INVITATION_TOKEN_LENGTH) {
    return null;
  }
  const claims = verifyEmailChallengeToken({
    purpose: "staff_invitation",
    secret: getServerEnv().BETTER_AUTH_SECRET,
    token,
  });
  return claims
    ? {
        expiresAt: claims.expiresAt,
        generation: claims.generation,
        invitationId: claims.challengeId,
      }
    : null;
};

export interface StaffInvitationPreview {
  alreadyAccepted: boolean;
  email: string;
  existingStudent: boolean;
  expiresAt: Date;
  inviterName: string;
  requiresName: boolean;
  role: StaffInvitationRole;
  willRemovePassword: boolean;
}

const getInvitationPreviewRecord = async (
  client: Pick<PoolClient, "query">,
  claims: InviteClaims
): Promise<StaffInvitationPreview | null> => {
  const result = await client.query<{
    accepted_by_user_id: string | null;
    email: string;
    email_verified: boolean | null;
    expires_at: Date;
    generation: number;
    has_credential: boolean | null;
    inviter_name: string | null;
    inviter_role: string | null;
    inviter_blocked_at: Date | null;
    inviter_email_verified: boolean | null;
    role: StaffInvitationRole;
    status: InvitationRow["status"];
    target_blocked_at: Date | null;
    target_role: IdentityRow["role"];
    user_id: string | null;
  }>(
    `select
       invitation.email,
       invitation.role,
       invitation.generation,
       invitation.status,
       invitation.accepted_by_user_id,
       invitation.expires_at,
       inviter.name as inviter_name,
       inviter_profile.role as inviter_role,
       inviter_profile.platform_blocked_at as inviter_blocked_at,
       inviter.email_verified as inviter_email_verified,
       target.id as user_id,
       target.email_verified,
       target.has_credential,
       target.role as target_role,
       target.platform_blocked_at as target_blocked_at
     from staff_invitations as invitation
     left join users as inviter on inviter.id = invitation.inviter_user_id
     left join profiles as inviter_profile on inviter_profile.user_id = inviter.id
     left join lateral (
       select users.id, users.email_verified,
              exists (
                select 1 from accounts
                where accounts.user_id = users.id
                  and accounts.provider_id = 'credential'
                  and accounts.password is not null
              ) as has_credential,
              profiles.role, profiles.platform_blocked_at
       from users
       left join profiles on profiles.user_id = users.id
       where public.canonicalize_auth_email_identity(users.email) =
         public.canonicalize_auth_email_identity(invitation.email)
       limit 1
     ) as target on true
     left join profiles as target_profile on target_profile.user_id = target.id
     where invitation.id = $1
     limit 1`,
    [claims.invitationId]
  );
  const row = result.rows[0];
  if (
    row?.status === "accepted" &&
    row.accepted_by_user_id &&
    row.generation === claims.generation &&
    row.expires_at.getTime() === claims.expiresAt.getTime() &&
    row.expires_at.getTime() > Date.now()
  ) {
    return {
      alreadyAccepted: true,
      email: row.email,
      expiresAt: row.expires_at,
      existingStudent: false,
      inviterName: row.inviter_name ?? "Equipe NeuroCapacitar",
      requiresName: false,
      role: row.role,
      willRemovePassword: false,
    };
  }
  if (
    row?.status !== "pending" ||
    row.generation !== claims.generation ||
    row.expires_at.getTime() !== claims.expiresAt.getTime() ||
    row.expires_at.getTime() <= Date.now() ||
    row.inviter_role !== "admin" ||
    row.inviter_blocked_at !== null ||
    row.inviter_email_verified !== true ||
    (row.user_id !== null && row.target_role !== "student") ||
    row.target_blocked_at !== null
  ) {
    return null;
  }
  return {
    alreadyAccepted: false,
    email: row.email,
    expiresAt: row.expires_at,
    existingStudent: row.target_role === "student",
    inviterName: row.inviter_name ?? "Equipe NeuroCapacitar",
    requiresName: !row.user_id,
    role: row.role,
    willRemovePassword:
      row.user_id !== null &&
      row.email_verified === false &&
      row.has_credential === true,
  };
};

export const previewStaffInvitation = async (
  token: string
): Promise<StaffInvitationPreview | null> => {
  const claims = parseStaffInvitationClaims(token);
  if (!claims) {
    return null;
  }
  return await getInvitationPreviewRecord(getPool(), claims);
};

type LockedStaffInvitation =
  | { kind: "accepted" }
  | {
      identity: IdentityRow | null;
      invitation: InvitationRow;
      kind: "pending";
    };

const lockStaffInvitationForAcceptance = async ({
  claims,
  client,
}: {
  claims: InviteClaims;
  client: Pick<PoolClient, "query">;
}): Promise<LockedStaffInvitation | null> => {
  const initial = await client.query<{ email: string }>(
    "select email from staff_invitations where id = $1 limit 1",
    [claims.invitationId]
  );
  const email = initial.rows[0]?.email;
  if (!email) {
    return null;
  }
  const canonicalEmail = await lockEmailIdentity(client, email);
  const identity = await getCanonicalIdentity(client, canonicalEmail);
  const invitationResult = await client.query<InvitationRow>(
    [
      "select *",
      "from staff_invitations",
      "where id = $1",
      "limit 1",
      "for update",
    ].join("\n"),
    [claims.invitationId]
  );
  const invitation = invitationResult.rows[0];
  if (
    !invitation ||
    invitation.generation !== claims.generation ||
    invitation.expires_at.getTime() !== claims.expiresAt.getTime() ||
    invitation.expires_at.getTime() <= Date.now()
  ) {
    return null;
  }
  if (invitation.status === "accepted" && invitation.accepted_by_user_id) {
    return { kind: "accepted" };
  }
  if (invitation.status !== "pending") {
    return null;
  }
  if (identity && identity.role !== "student") {
    return null;
  }
  return { identity, invitation, kind: "pending" };
};

const isActiveInvitationAdmin = async (
  client: Pick<PoolClient, "query">,
  inviterUserId: string | null
): Promise<boolean> => {
  if (!inviterUserId) {
    return false;
  }
  const inviter = await client.query<{ email_verified: boolean; role: string }>(
    [
      "select profiles.role, users.email_verified",
      "from profiles",
      "join users on users.id = profiles.user_id",
      "where profiles.user_id = $1 and profiles.platform_blocked_at is null",
      "limit 1",
      "for share of profiles, users",
    ].join("\n"),
    [inviterUserId]
  );
  return (
    inviter.rows[0]?.role === "admin" &&
    inviter.rows[0]?.email_verified === true
  );
};

interface AcceptedStaffIdentity {
  convertedFromStudent: boolean;
  emailClaimed: boolean;
  userId: string;
}

const applyStaffInvitationToIdentity = async ({
  client,
  identity,
  invitation,
  name,
}: {
  client: PoolClient;
  identity: IdentityRow | null;
  invitation: InvitationRow;
  name: string;
}): Promise<AcceptedStaffIdentity | null> => {
  const wasUnverified = identity ? !identity.email_verified : false;
  let userId = identity?.id;
  if (!userId) {
    const inserted = await client.query<{ id: string }>(
      [
        "insert into users (id, name, email, email_verified)",
        "values ($1, $2, $3, true)",
        "on conflict do nothing",
        "returning id",
      ].join("\n"),
      [randomUUID(), name, invitation.email]
    );
    userId = inserted.rows[0]?.id;
    if (!userId) {
      return null;
    }
  }

  const profileResult = await client.query<{
    platform_blocked_at: Date | null;
    role: string;
  }>(
    [
      "select role, platform_blocked_at",
      "from profiles",
      "where user_id = $1",
      "limit 1",
      "for update",
    ].join("\n"),
    [userId]
  );
  const profile = profileResult.rows[0];
  if (!profile || profile.platform_blocked_at || profile.role !== "student") {
    if (identity) {
      return null;
    }
    throw new Error("O Perfil da nova Conta não foi criado corretamente.");
  }

  if (wasUnverified) {
    await client.query(
      "delete from accounts where user_id = $1 and provider_id = 'credential'",
      [userId]
    );
    await client.query("delete from sessions where user_id = $1", [userId]);
    await client.query(
      "update users set email_verified = true, updated_at = now() where id = $1 and email_verified = false",
      [userId]
    );
  }

  const roleChanged = await client.query(
    [
      "update profiles",
      "set role = $2::role,",
      "    support_permission_grants = $3::text[],",
      "    support_permission_views = $4::text[],",
      "    updated_at = now()",
      "where user_id = $1 and role = 'student'",
    ].join("\n"),
    [
      userId,
      invitation.role,
      invitation.role === "support" ? invitation.support_permission_grants : [],
      invitation.role === "support" ? invitation.support_permission_views : [],
    ]
  );
  if (roleChanged.rowCount !== 1) {
    throw new Error("Não foi possível aplicar o papel do convite.");
  }
  return {
    convertedFromStudent: Boolean(identity),
    emailClaimed: wasUnverified,
    userId,
  };
};

export const acceptStaffInvitation = async ({
  name,
  token,
}: {
  name: string;
  token: string;
}): Promise<{ nextPath: string } | null> => {
  const claims = parseStaffInvitationClaims(token);
  if (!claims) {
    return null;
  }
  const normalizedName = name.trim();
  if (normalizedName.length > 120) {
    return null;
  }

  return await withTransaction(async (client) => {
    const locked = await lockStaffInvitationForAcceptance({ claims, client });
    if (!locked) {
      return null;
    }
    if (locked.kind === "accepted") {
      return { nextPath: "/entrar?returnTo=%2Fadmin" };
    }
    const { identity, invitation } = locked;
    if (!identity && normalizedName.length < 2) {
      return null;
    }
    if (!(await isActiveInvitationAdmin(client, invitation.inviter_user_id))) {
      return null;
    }

    const target = await applyStaffInvitationToIdentity({
      client,
      identity,
      invitation,
      name: normalizedName,
    });
    if (!target) {
      return null;
    }
    const accepted = await client.query(
      [
        "update staff_invitations",
        "set status = 'accepted',",
        "    accepted_at = now(),",
        "    accepted_by_user_id = $2,",
        "    updated_at = now()",
        "where id = $1",
        "  and status = 'pending'",
        "  and generation = $3",
        "  and expires_at > now()",
      ].join("\n"),
      [claims.invitationId, target.userId, claims.generation]
    );
    if (accepted.rowCount !== 1) {
      throw new Error("O convite deixou de estar válido durante o aceite.");
    }
    await writeAuditLog({
      action: "staff.invitation_accepted",
      actorUserId: target.userId,
      client,
      metadata: {
        convertedFromStudent: target.convertedFromStudent,
        emailClaimed: target.emailClaimed,
        invitationId: claims.invitationId,
        role: invitation.role,
        supportPermissionGrants:
          invitation.role === "support"
            ? invitation.support_permission_grants
            : [],
        supportPermissionViews:
          invitation.role === "support"
            ? invitation.support_permission_views
            : [],
      },
      targetId: target.userId,
      targetType: "staff",
    });
    return { nextPath: "/entrar?returnTo=%2Fadmin" };
  });
};

export const expireStaffInvitations = async ({
  client,
}: {
  client: Pick<PoolClient, "query">;
}): Promise<number> => {
  const result = await client.query(
    `update staff_invitations
     set status = 'expired', updated_at = now()
     where status = 'pending' and expires_at <= now()`
  );
  return result.rowCount ?? 0;
};

export const getStaffInvitationDeliveryData = async ({
  generation,
  invitationId,
}: {
  generation: number;
  invitationId: string;
}): Promise<{
  email: string;
  expiresAt: Date;
  generation: number;
  inviterName: string;
  role: StaffInvitationRole;
} | null> => {
  const result = await getPool().query<{
    email: string;
    expires_at: Date;
    generation: number;
    inviter_name: string;
    inviter_role: string | null;
    inviter_blocked_at: Date | null;
    inviter_email_verified: boolean | null;
    role: StaffInvitationRole;
    status: InvitationRow["status"];
  }>(
    `select
       invitation.email,
       invitation.role,
       invitation.generation,
       invitation.status,
       invitation.expires_at,
       inviter.name as inviter_name,
       inviter_profile.role as inviter_role,
       inviter_profile.platform_blocked_at as inviter_blocked_at,
       inviter.email_verified as inviter_email_verified
     from staff_invitations as invitation
     left join users as inviter on inviter.id = invitation.inviter_user_id
     left join profiles as inviter_profile on inviter_profile.user_id = inviter.id
     where invitation.id = $1
     limit 1`,
    [invitationId]
  );
  const row = result.rows[0];
  if (
    row?.status !== "pending" ||
    row.generation !== generation ||
    row.expires_at.getTime() <= Date.now() ||
    row.inviter_role !== "admin" ||
    row.inviter_blocked_at !== null ||
    row.inviter_email_verified !== true
  ) {
    return null;
  }
  return {
    email: row.email,
    expiresAt: row.expires_at,
    generation: row.generation,
    inviterName: row.inviter_name,
    role: row.role,
  };
};

export const createStaffInvitationUrlToken = ({
  expiresAt,
  generation,
  invitationId,
}: {
  expiresAt: Date;
  generation: number;
  invitationId: string;
}): string =>
  createEmailChallengeToken({
    challengeId: invitationId,
    expiresAt,
    generation,
    purpose: "staff_invitation",
    secret: getServerEnv().BETTER_AUTH_SECRET,
  });
