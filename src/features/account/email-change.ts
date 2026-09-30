import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import {
  createEmailChallengeToken,
  verifyEmailChallengeToken,
} from "@/features/account/email-challenge-token";
import { writeAuditLog } from "@/features/admin/audit-log";
import {
  createEmailChangeConfirmationMessage,
  createEmailChangeNoticeMessage,
} from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";
import { normalizeBuyerEmail } from "@/lib/email-identity";
import { getServerEnv } from "@/lib/env";

const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;
const EMAIL_CHANGE_REQUEST_LIMIT = 3;
const EMAIL_CHANGE_RATE_WINDOW_MS = 60 * 60 * 1000;
const sql = (...lines: string[]): string => lines.join("\n");

type EmailChangeStage = "pending_current" | "pending_new";
type EmailChangeStatus =
  | "cancelled"
  | "completed"
  | "expired"
  | EmailChangeStage;

interface EmailChangeRequestRow {
  completed_at: Date | null;
  current_confirmed_at: Date | null;
  current_email: string;
  expires_at: Date;
  generation: number;
  id: string;
  new_email: string;
  status: EmailChangeStatus;
  user_id: string;
}

interface EmailChangeTokenClaims {
  changeRequestId: string;
  expiresAt: Date;
  generation: number;
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
      // Preserve the original failure.
    }
    throw error;
  } finally {
    client.release();
  }
};

const lockUserEmailChange = async (
  client: Pick<PoolClient, "query">,
  userId: string
): Promise<void> => {
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `account-email-change:${userId}`,
  ]);
};

const lockEmailIdentities = async (
  client: Pick<PoolClient, "query">,
  emails: readonly string[]
): Promise<void> => {
  const identities = [...new Set(emails.map(normalizeBuyerEmail))].sort();
  for (const identity of identities) {
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`account-email:${identity}`]
    );
  }
};

const hashEmailChangeRateLimitKey = (userId: string): string =>
  createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update("hub:account-email-change-rate-limit:v1\0")
    .update(userId)
    .digest("hex");

const consumeEmailChangeRateLimit = async (
  client: Pick<PoolClient, "query">,
  userId: string
): Promise<boolean> => {
  const result = await client.query<{ request_count: number }>(
    sql(
      "insert into account_email_challenge_rate_limits (",
      "  key_hash, window_started_at, request_count, expires_at",
      ") values ($1, now(), 1, now() + ($2 * interval '1 millisecond'))",
      "on conflict (key_hash) do update set",
      "  window_started_at = case",
      "    when account_email_challenge_rate_limits.expires_at <= now() then now()",
      "    else account_email_challenge_rate_limits.window_started_at",
      "  end,",
      "  request_count = case",
      "    when account_email_challenge_rate_limits.expires_at <= now() then 1",
      "    else account_email_challenge_rate_limits.request_count + 1",
      "  end,",
      "  expires_at = case",
      "    when account_email_challenge_rate_limits.expires_at <= now()",
      "      then now() + ($2 * interval '1 millisecond')",
      "    else account_email_challenge_rate_limits.expires_at",
      "  end,",
      "  updated_at = now()",
      "returning request_count"
    ),
    [hashEmailChangeRateLimitKey(userId), EMAIL_CHANGE_RATE_WINDOW_MS]
  );
  return (
    (result.rows[0]?.request_count ?? Number.MAX_SAFE_INTEGER) <=
    EMAIL_CHANGE_REQUEST_LIMIT
  );
};

const supersedePendingConfirmationMessages = async ({
  actorUserId,
  changeRequestId,
  client,
  reason = "email_change_generation_rotated",
}: {
  actorUserId: string;
  changeRequestId: string;
  client: PoolClient;
  reason?:
    | "email_change_generation_rotated"
    | "email_change_request_cancelled"
    | "email_change_request_completed";
}): Promise<void> => {
  const result = await client.query<{ id: string }>(
    sql(
      "update outbox_messages",
      "set status = 'superseded',",
      "    superseded_at = now(),",
      "    delivered_at = null,",
      "    locked_at = null,",
      "    locked_by = null,",
      "    last_error_code = $2,",
      "    last_error_at = now(),",
      "    updated_at = now()",
      "where aggregate_type = 'account_email_change'",
      "  and aggregate_id = $1",
      "  and topic = 'auth.email-change-confirmation'",
      "  and status in ('pending', 'retrying', 'dead_letter')",
      "returning id"
    ),
    [changeRequestId, reason]
  );
  for (const message of result.rows) {
    await writeAuditLog({
      action: "outbox.superseded",
      actorUserId,
      client,
      metadata: { reason },
      targetId: message.id,
      targetType: "outbox_message",
    });
  }
};

const enqueueConfirmation = async ({
  changeRequestId,
  client,
  generation,
}: {
  changeRequestId: string;
  client: PoolClient;
  generation: number;
}): Promise<void> => {
  await enqueueOutboxMessage({
    client,
    message: createEmailChangeConfirmationMessage({
      changeRequestId,
      generation,
    }),
  });
};

export interface ActiveEmailChangeSummary {
  expiresAt: Date;
  newEmail: string;
  status: EmailChangeStage | "expired";
}

export const getActiveEmailChangeSummary = async (
  userId: string
): Promise<ActiveEmailChangeSummary | null> => {
  const result = await getPool().query<{
    expires_at: Date;
    new_email: string;
    status: EmailChangeStatus;
  }>(
    sql(
      "select new_email, status, expires_at",
      "from account_email_change_requests",
      "where user_id = $1 and status in ('pending_current', 'pending_new')",
      "limit 1"
    ),
    [userId]
  );
  const row = result.rows[0];
  if (
    !row ||
    (row.status !== "pending_current" && row.status !== "pending_new")
  ) {
    return null;
  }
  return {
    expiresAt: row.expires_at,
    newEmail: row.new_email,
    status: row.expires_at.getTime() <= Date.now() ? "expired" : row.status,
  };
};

const requireVerifiedAccountEmail = async (
  client: Pick<PoolClient, "query">,
  userId: string,
  lock = false
): Promise<string> => {
  const result = await client.query<{
    email: string;
    email_verified: boolean;
  }>(
    sql(
      "select email, email_verified",
      "from users",
      "where id = $1",
      "limit 1",
      ...(lock ? ["for update"] : [])
    ),
    [userId]
  );
  const user = result.rows[0];
  if (!user?.email_verified) {
    throw new Error("Confirme seu e-mail antes de solicitar uma alteração.");
  }
  return user.email;
};

const assertEmailChangeTargetAvailable = async (
  client: Pick<PoolClient, "query">,
  newIdentity: string,
  userId: string
): Promise<void> => {
  const taken = await client.query<{ id: string }>(
    sql(
      "select id",
      "from users",
      "where public.canonicalize_auth_email_identity(email) = $1",
      "  and id <> $2",
      "limit 1",
      "for update"
    ),
    [newIdentity, userId]
  );
  if (taken.rows.length > 0) {
    throw new Error("Esse endereço já está associado a outra Conta.");
  }
  const reserved = await client.query<{ id: string }>(
    sql(
      "select id",
      "from account_email_change_requests",
      "where public.canonicalize_auth_email_identity(new_email) = $1",
      "  and user_id <> $2",
      "  and status in ('pending_current', 'pending_new')",
      "limit 1"
    ),
    [newIdentity, userId]
  );
  if (reserved.rows.length > 0) {
    throw new Error(
      "Esse endereço está em outra alteração de e-mail pendente."
    );
  }
};

const saveEmailChangeRequest = async ({
  client,
  currentEmail,
  expiresAt,
  newEmail,
  userId,
}: {
  client: PoolClient;
  currentEmail: string;
  expiresAt: Date;
  newEmail: string;
  userId: string;
}): Promise<{ changeRequestId: string; generation: number }> => {
  const existingResult = await client.query<{
    generation: number;
    id: string;
  }>(
    sql(
      "select id, generation",
      "from account_email_change_requests",
      "where user_id = $1 and status in ('pending_current', 'pending_new')",
      "limit 1",
      "for update"
    ),
    [userId]
  );
  const existing = existingResult.rows[0];
  if (existing) {
    const updated = await client.query<{ generation: number }>(
      sql(
        "update account_email_change_requests",
        "set current_email = $2,",
        "    new_email = $3,",
        "    status = 'pending_current',",
        "    generation = generation + 1,",
        "    expires_at = $4,",
        "    current_confirmed_at = null,",
        "    completed_at = null,",
        "    cancelled_at = null,",
        "    updated_at = now()",
        "where id = $1",
        "returning generation"
      ),
      [existing.id, currentEmail, newEmail, expiresAt]
    );
    const generation = updated.rows[0]?.generation;
    if (!generation) {
      throw new Error("Não foi possível iniciar a alteração de e-mail.");
    }
    await supersedePendingConfirmationMessages({
      actorUserId: userId,
      changeRequestId: existing.id,
      client,
    });
    return { changeRequestId: existing.id, generation };
  }

  const inserted = await client.query<{ generation: number; id: string }>(
    sql(
      "insert into account_email_change_requests (",
      "  id, user_id, current_email, new_email, status, generation, expires_at",
      ") values ($1, $2, $3, $4, 'pending_current', 1, $5)",
      "returning id, generation"
    ),
    [randomUUID(), userId, currentEmail, newEmail, expiresAt]
  );
  const row = inserted.rows[0];
  if (!row) {
    throw new Error("Não foi possível iniciar a alteração de e-mail.");
  }
  return { changeRequestId: row.id, generation: row.generation };
};

export const createOrRefreshEmailChangeRequest = async ({
  newEmail,
  userId,
}: {
  newEmail: string;
  userId: string;
}): Promise<{ expiresAt: Date; status: "pending_current" }> => {
  const outcome = await withTransaction(async (client) => {
    const initialEmail = await requireVerifiedAccountEmail(client, userId);
    const normalizedNewEmail = newEmail.trim().toLowerCase();
    const currentIdentity = normalizeBuyerEmail(initialEmail);
    const newIdentity = normalizeBuyerEmail(normalizedNewEmail);
    if (currentIdentity === newIdentity) {
      throw new Error("Informe um endereço diferente do atual.");
    }

    await lockUserEmailChange(client, userId);
    await lockEmailIdentities(client, [initialEmail, normalizedNewEmail]);
    const currentEmail = await requireVerifiedAccountEmail(
      client,
      userId,
      true
    );
    if (normalizeBuyerEmail(currentEmail) !== currentIdentity) {
      throw new Error(
        "O e-mail da Conta mudou. Atualize a página e tente novamente."
      );
    }
    await assertEmailChangeTargetAvailable(client, newIdentity, userId);

    const rateLimitAllowed = await consumeEmailChangeRateLimit(client, userId);
    if (!rateLimitAllowed) {
      return { kind: "rate_limited" } as const;
    }

    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
    const saved = await saveEmailChangeRequest({
      client,
      currentEmail,
      expiresAt,
      newEmail: normalizedNewEmail,
      userId,
    });

    await enqueueConfirmation({
      changeRequestId: saved.changeRequestId,
      client,
      generation: saved.generation,
    });
    await writeAuditLog({
      action: "account.email_change_requested",
      actorUserId: userId,
      client,
      metadata: { stage: "pending_current" },
      targetId: userId,
      targetType: "account",
    });
    return {
      kind: "created",
      value: { expiresAt, status: "pending_current" as const },
    } as const;
  });
  if (outcome.kind === "rate_limited") {
    throw new Error(
      "Você solicitou muitas alterações. Tente novamente mais tarde."
    );
  }
  return outcome.value;
};

const parseEmailChangeClaims = (
  token: string
): EmailChangeTokenClaims | null => {
  if (!token || token.length > 512) {
    return null;
  }
  const claims = verifyEmailChallengeToken({
    purpose: "change_email",
    secret: getServerEnv().BETTER_AUTH_SECRET,
    token,
  });
  return claims
    ? {
        changeRequestId: claims.challengeId,
        expiresAt: claims.expiresAt,
        generation: claims.generation,
      }
    : null;
};

export interface EmailChangePreview {
  currentEmail: string;
  expiresAt: Date;
  newEmail: string;
  stage: EmailChangeStage | "awaiting_new" | "completed";
  userName: string;
}

const getEmailChangeRequestPreview = async ({
  claims,
  client,
}: {
  claims: EmailChangeTokenClaims;
  client: Pick<PoolClient, "query">;
}): Promise<EmailChangePreview | null> => {
  const result = await client.query<{
    current_email: string;
    current_confirmed_at: Date | null;
    email_verified: boolean;
    expires_at: Date;
    generation: number;
    new_email: string;
    status: EmailChangeStatus;
    user_email: string;
    user_name: string;
  }>(
    sql(
      "select request.current_email, request.new_email, request.status,",
      "       request.current_confirmed_at,",
      "       request.generation, request.expires_at,",
      "       users.email as user_email, users.email_verified, users.name as user_name",
      "from account_email_change_requests as request",
      "join users on users.id = request.user_id",
      "where request.id = $1",
      "limit 1"
    ),
    [claims.changeRequestId]
  );
  const row = result.rows[0];
  if (
    row &&
    row.status === "completed" &&
    row.generation === claims.generation &&
    row.expires_at.getTime() === claims.expiresAt.getTime() &&
    row.expires_at.getTime() > Date.now() &&
    row.email_verified &&
    normalizeBuyerEmail(row.user_email) === normalizeBuyerEmail(row.new_email)
  ) {
    return {
      currentEmail: row.current_email,
      expiresAt: row.expires_at,
      newEmail: row.new_email,
      stage: "completed",
      userName: row.user_name,
    };
  }
  if (
    row &&
    row.status === "pending_new" &&
    row.current_confirmed_at &&
    claims.generation + 1 === row.generation &&
    claims.expiresAt.getTime() > Date.now() &&
    row.email_verified &&
    normalizeBuyerEmail(row.user_email) ===
      normalizeBuyerEmail(row.current_email)
  ) {
    return {
      currentEmail: row.current_email,
      expiresAt: row.expires_at,
      newEmail: row.new_email,
      stage: "awaiting_new",
      userName: row.user_name,
    };
  }
  if (
    !row ||
    (row.status !== "pending_current" && row.status !== "pending_new") ||
    row.generation !== claims.generation ||
    row.expires_at.getTime() !== claims.expiresAt.getTime() ||
    row.expires_at.getTime() <= Date.now() ||
    !row.email_verified ||
    normalizeBuyerEmail(row.user_email) !==
      normalizeBuyerEmail(row.current_email)
  ) {
    return null;
  }
  return {
    currentEmail: row.current_email,
    expiresAt: row.expires_at,
    newEmail: row.new_email,
    stage: row.status,
    userName: row.user_name,
  };
};

export const previewEmailChange = async (
  token: string
): Promise<EmailChangePreview | null> => {
  const claims = parseEmailChangeClaims(token);
  if (!claims) {
    return null;
  }
  return await getEmailChangeRequestPreview({
    claims,
    client: getPool(),
  });
};

export const createEmailChangeToken = ({
  changeRequestId,
  expiresAt,
  generation,
}: {
  changeRequestId: string;
  expiresAt: Date;
  generation: number;
}): string =>
  createEmailChallengeToken({
    challengeId: changeRequestId,
    expiresAt,
    generation,
    purpose: "change_email",
    secret: getServerEnv().BETTER_AUTH_SECRET,
  });

export const getEmailChangeConfirmationDeliveryData = async ({
  changeRequestId,
  generation,
}: {
  changeRequestId: string;
  generation: number;
}): Promise<{
  changeRequestId: string;
  currentEmail: string;
  expiresAt: Date;
  generation: number;
  newEmail: string;
  stage: EmailChangeStage;
  to: string;
  userName: string;
} | null> => {
  const result = await getPool().query<{
    current_email: string;
    email_verified: boolean;
    expires_at: Date;
    generation: number;
    new_email: string;
    status: EmailChangeStatus;
    user_email: string;
    user_name: string;
  }>(
    sql(
      "select request.current_email, request.new_email, request.status,",
      "       request.generation, request.expires_at,",
      "       users.email as user_email, users.email_verified, users.name as user_name",
      "from account_email_change_requests as request",
      "join users on users.id = request.user_id",
      "where request.id = $1",
      "limit 1"
    ),
    [changeRequestId]
  );
  const row = result.rows[0];
  if (
    !row ||
    (row.status !== "pending_current" && row.status !== "pending_new") ||
    row.generation !== generation ||
    row.expires_at.getTime() <= Date.now() ||
    !row.email_verified ||
    normalizeBuyerEmail(row.user_email) !==
      normalizeBuyerEmail(row.current_email)
  ) {
    return null;
  }
  return {
    changeRequestId,
    currentEmail: row.current_email,
    expiresAt: row.expires_at,
    generation: row.generation,
    newEmail: row.new_email,
    stage: row.status,
    to: row.status === "pending_current" ? row.current_email : row.new_email,
    userName: row.user_name,
  };
};

export const getEmailChangeNoticeDeliveryData = async ({
  changeRequestId,
  recipient,
}: {
  changeRequestId: string;
  recipient: "current" | "new";
}): Promise<{
  completedAt: Date;
  currentEmail: string;
  newEmail: string;
  to: string;
  userName: string;
} | null> => {
  const result = await getPool().query<{
    completed_at: Date | null;
    current_email: string;
    new_email: string;
    status: EmailChangeStatus;
    user_name: string;
  }>(
    sql(
      "select request.current_email, request.new_email, request.status,",
      "       request.completed_at, users.name as user_name",
      "from account_email_change_requests as request",
      "join users on users.id = request.user_id",
      "where request.id = $1",
      "limit 1"
    ),
    [changeRequestId]
  );
  const row = result.rows[0];
  if (row?.status !== "completed" || !row.completed_at) {
    return null;
  }
  return {
    completedAt: row.completed_at,
    currentEmail: row.current_email,
    newEmail: row.new_email,
    to: recipient === "current" ? row.current_email : row.new_email,
    userName: row.user_name,
  };
};

const getIdempotentEmailChangePath = (
  request: EmailChangeRequestRow,
  claims: EmailChangeTokenClaims
): string | null => {
  if (
    request.status === "pending_new" &&
    request.current_confirmed_at &&
    claims.generation + 1 === request.generation &&
    claims.expiresAt.getTime() > Date.now()
  ) {
    return "/confirmar-troca-email?status=awaiting-new";
  }
  if (
    request.status === "completed" &&
    request.completed_at &&
    request.generation === claims.generation &&
    claims.expiresAt.getTime() > Date.now()
  ) {
    return "/entrar?emailChanged=1";
  }
  return null;
};

const isCurrentEmailChangeToken = (
  request: EmailChangeRequestRow,
  claims: EmailChangeTokenClaims
): request is EmailChangeRequestRow & { status: EmailChangeStage } =>
  request.generation === claims.generation &&
  request.expires_at.getTime() === claims.expiresAt.getTime() &&
  request.expires_at.getTime() > Date.now() &&
  (request.status === "pending_current" || request.status === "pending_new");

const getVerifiedCurrentEmailChangeUser = async (
  client: Pick<PoolClient, "query">,
  request: EmailChangeRequestRow
): Promise<{ email: string; id: string } | null> => {
  const result = await client.query<{
    email: string;
    email_verified: boolean;
    id: string;
  }>(
    sql(
      "select id, email, email_verified",
      "from users",
      "where id = $1",
      "limit 1",
      "for update"
    ),
    [request.user_id]
  );
  const user = result.rows[0];
  if (
    !user?.email_verified ||
    normalizeBuyerEmail(user.email) !==
      normalizeBuyerEmail(request.current_email)
  ) {
    return null;
  }
  return user;
};

const confirmCurrentEmailChange = async ({
  client,
  request,
  userId,
}: {
  client: PoolClient;
  request: EmailChangeRequestRow;
  userId: string;
}): Promise<{ nextPath: string }> => {
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);
  const updated = await client.query(
    sql(
      "update account_email_change_requests",
      "set status = 'pending_new',",
      "    current_confirmed_at = now(),",
      "    generation = generation + 1,",
      "    expires_at = $2,",
      "    updated_at = now()",
      "where id = $1 and status = 'pending_current'",
      "returning id"
    ),
    [request.id, expiresAt]
  );
  if (updated.rowCount !== 1) {
    throw new Error("email_change_stage_conflict");
  }
  await enqueueConfirmation({
    changeRequestId: request.id,
    client,
    generation: request.generation + 1,
  });
  await writeAuditLog({
    action: "account.email_change_current_confirmed",
    actorUserId: userId,
    client,
    metadata: { stage: "pending_new" },
    targetId: userId,
    targetType: "account",
  });
  return { nextPath: "/confirmar-troca-email?status=awaiting-new" };
};

const completeEmailChange = async ({
  client,
  request,
  userId,
}: {
  client: PoolClient;
  request: EmailChangeRequestRow;
  userId: string;
}): Promise<{ nextPath: string } | null> => {
  const targetIdentity = normalizeBuyerEmail(request.new_email);
  const taken = await client.query<{ id: string }>(
    sql(
      "select id",
      "from users",
      "where public.canonicalize_auth_email_identity(email) = $1",
      "  and id <> $2",
      "limit 1",
      "for update"
    ),
    [targetIdentity, userId]
  );
  if (taken.rows.length > 0) {
    return null;
  }
  const changed = await client.query(
    sql(
      "update users",
      "set email = $2, email_verified = true, updated_at = now()",
      "where id = $1",
      "  and public.canonicalize_auth_email_identity(email) = $3"
    ),
    [userId, request.new_email, normalizeBuyerEmail(request.current_email)]
  );
  if (changed.rowCount !== 1) {
    throw new Error("email_change_account_conflict");
  }
  const completed = await client.query(
    sql(
      "update account_email_change_requests",
      "set status = 'completed', completed_at = now(), updated_at = now()",
      "where id = $1 and status = 'pending_new'",
      "returning id"
    ),
    [request.id]
  );
  if (completed.rowCount !== 1) {
    throw new Error("email_change_completion_conflict");
  }
  await supersedePendingConfirmationMessages({
    actorUserId: userId,
    changeRequestId: request.id,
    client,
    reason: "email_change_request_completed",
  });
  await client.query("delete from sessions where user_id = $1", [userId]);
  for (const recipient of ["current", "new"] as const) {
    await enqueueOutboxMessage({
      client,
      message: createEmailChangeNoticeMessage({
        changeRequestId: request.id,
        recipient,
      }),
    });
  }
  await writeAuditLog({
    action: "account.email_change_completed",
    actorUserId: userId,
    client,
    metadata: { notificationRecipients: 2 },
    targetId: userId,
    targetType: "account",
  });
  return { nextPath: "/entrar?emailChanged=1" };
};

export const consumeEmailChangeToken = async (
  token: string
): Promise<{ nextPath: string } | null> => {
  const claims = parseEmailChangeClaims(token);
  if (!claims) {
    return null;
  }
  const initialResult = await getPool().query<{
    current_email: string;
    new_email: string;
    user_id: string;
  }>(
    sql(
      "select user_id, current_email, new_email",
      "from account_email_change_requests",
      "where id = $1",
      "limit 1"
    ),
    [claims.changeRequestId]
  );
  const initial = initialResult.rows[0];
  if (!initial) {
    return null;
  }

  return await withTransaction(async (client) => {
    await lockUserEmailChange(client, initial.user_id);
    await lockEmailIdentities(client, [
      initial.current_email,
      initial.new_email,
    ]);
    const requestResult = await client.query<EmailChangeRequestRow>(
      sql(
        "select *",
        "from account_email_change_requests",
        "where id = $1",
        "limit 1",
        "for update"
      ),
      [claims.changeRequestId]
    );
    const request = requestResult.rows[0];
    if (!request) {
      return null;
    }
    const idempotentPath = getIdempotentEmailChangePath(request, claims);
    if (idempotentPath) {
      return { nextPath: idempotentPath };
    }
    if (!isCurrentEmailChangeToken(request, claims)) {
      return null;
    }
    const user = await getVerifiedCurrentEmailChangeUser(client, request);
    if (!user) {
      return null;
    }
    if (request.status === "pending_current") {
      return await confirmCurrentEmailChange({
        client,
        request,
        userId: user.id,
      });
    }
    return await completeEmailChange({
      client,
      request,
      userId: user.id,
    });
  });
};

export const cancelEmailChangeRequest = async ({
  userId,
}: {
  userId: string;
}): Promise<void> =>
  await withTransaction(async (client) => {
    await lockUserEmailChange(client, userId);
    const result = await client.query<EmailChangeRequestRow>(
      sql(
        "select *",
        "from account_email_change_requests",
        "where user_id = $1 and status in ('pending_current', 'pending_new', 'expired')",
        "limit 1",
        "for update"
      ),
      [userId]
    );
    const request = result.rows[0];
    if (!request) {
      return;
    }
    await client.query(
      sql(
        "update account_email_change_requests",
        "set status = 'cancelled',",
        "    cancelled_at = now(),",
        "    generation = generation + 1,",
        "    updated_at = now()",
        "where id = $1"
      ),
      [request.id]
    );
    await supersedePendingConfirmationMessages({
      actorUserId: userId,
      changeRequestId: request.id,
      client,
      reason: "email_change_request_cancelled",
    });
    await writeAuditLog({
      action: "account.email_change_cancelled",
      actorUserId: userId,
      client,
      metadata: {},
      targetId: userId,
      targetType: "account",
    });
  });

export const expireAccountEmailChangeRequests = async ({
  client,
}: {
  client: Pick<PoolClient, "query">;
}): Promise<{ expired: number; removed: number }> => {
  const expired = await client.query(
    sql(
      "update account_email_change_requests",
      "set status = 'expired', generation = generation + 1, updated_at = now()",
      "where status in ('pending_current', 'pending_new') and expires_at <= now()"
    )
  );
  const removed = await client.query(
    sql(
      "delete from account_email_change_requests as request",
      "where request.status in ('completed', 'cancelled', 'expired')",
      "  and request.updated_at < now() - interval '30 days'",
      "  and not exists (",
      "    select 1 from outbox_messages as message",
      "    where message.aggregate_type = 'account_email_change'",
      "      and message.aggregate_id = request.id::text",
      "      and message.topic = 'email.email-change-notice'",
      "      and message.status not in ('delivered', 'superseded')",
      "  )"
    )
  );
  return {
    expired: expired.rowCount ?? 0,
    removed: removed.rowCount ?? 0,
  };
};
