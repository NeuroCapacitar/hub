import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { lockAccountIdentity } from "@/features/account/account-identity-lock";
import { normalizeBuyerEmail } from "@/lib/email-identity";

const PASSWORD_RESET_OPERATION_TTL_MINUTES = 15;
const MAX_RESET_TOKEN_LENGTH = 256;

type PasswordResetEndpoint = "request-password-reset" | "reset-password";
type QueryClient = Pick<PoolClient, "query">;

interface PasswordResetIntent {
  email?: string;
  endpoint: PasswordResetEndpoint;
  token?: string;
}

interface PasswordResetOperation {
  id: string;
  userId: string;
}

const withTransaction = async <T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getPool().connect();
  let transactionOpen = false;
  try {
    await client.query("begin");
    transactionOpen = true;
    const result = await operation(client);
    await client.query("commit");
    transactionOpen = false;
    return result;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the original failure.
      }
    }
    throw error;
  } finally {
    client.release();
  }
};

const getPasswordResetIntent = async (
  request: Request,
  endpoint: PasswordResetEndpoint
): Promise<PasswordResetIntent | null> => {
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    body = null;
  }

  if (endpoint === "request-password-reset") {
    const email =
      body && typeof body === "object" && !Array.isArray(body)
        ? Reflect.get(body, "email")
        : null;
    if (
      typeof email !== "string" ||
      email.length > 320 ||
      !email.includes("@")
    ) {
      return null;
    }
    return { email: normalizeBuyerEmail(email), endpoint };
  }

  const bodyToken =
    body && typeof body === "object" && !Array.isArray(body)
      ? Reflect.get(body, "token")
      : null;
  const queryToken = new URL(request.url).searchParams.get("token");
  const token =
    typeof bodyToken === "string" && bodyToken.length > 0
      ? bodyToken
      : queryToken;
  if (!token || token.length > MAX_RESET_TOKEN_LENGTH) {
    return null;
  }
  return { endpoint, token };
};

const findCandidateUserId = async (
  client: QueryClient,
  intent: PasswordResetIntent
): Promise<string | null> => {
  if (intent.endpoint === "request-password-reset" && intent.email) {
    const result = await client.query<{ id: string }>(
      `select id
       from users
       where public.canonicalize_auth_email_identity(email) = $1
       limit 1`,
      [intent.email]
    );
    return result.rows[0]?.id ?? null;
  }

  if (intent.endpoint === "reset-password" && intent.token) {
    const result = await client.query<{ user_id: string }>(
      `select value as user_id
       from verifications
       where identifier = $1
         and expires_at > now()
       limit 1`,
      [`reset-password:${intent.token}`]
    );
    return result.rows[0]?.user_id ?? null;
  }

  return null;
};

const isPasswordResetIntentCurrent = async (
  client: QueryClient,
  intent: PasswordResetIntent,
  userId: string
): Promise<boolean> => {
  if (intent.endpoint === "request-password-reset" && intent.email) {
    const result = await client.query<{ id: string }>(
      `select id
       from users
       where id = $1
         and public.canonicalize_auth_email_identity(email) = $2
       limit 1
       for update`,
      [userId, intent.email]
    );
    return Boolean(result.rows[0]);
  }

  if (intent.endpoint === "reset-password" && intent.token) {
    const result = await client.query<{ id: string }>(
      `select id
       from verifications
       where identifier = $1
         and value = $2
         and expires_at > now()
       limit 1
       for update`,
      [`reset-password:${intent.token}`, userId]
    );
    return Boolean(result.rows[0]);
  }

  return false;
};

const beginPasswordResetOperation = async (
  request: Request,
  endpoint: PasswordResetEndpoint
): Promise<PasswordResetOperation | null> => {
  const intent = await getPasswordResetIntent(request, endpoint);
  if (!intent) {
    return null;
  }

  return await withTransaction(async (client) => {
    const userId = await findCandidateUserId(client, intent);
    if (!userId) {
      return null;
    }

    await lockAccountIdentity(client, userId);
    if (!(await isPasswordResetIntentCurrent(client, intent, userId))) {
      return null;
    }

    const id = randomUUID();
    await client.query(
      `delete from account_password_reset_operations
       where user_id = $1 and expires_at <= now()`,
      [userId]
    );
    await client.query(
      `insert into account_password_reset_operations (
         id, user_id, operation, expires_at
       ) values ($1, $2, $3, now() + ($4 * interval '1 minute'))`,
      [
        id,
        userId,
        endpoint === "request-password-reset" ? "request" : "consume",
        PASSWORD_RESET_OPERATION_TTL_MINUTES,
      ]
    );
    return { id, userId };
  });
};

const finishPasswordResetOperation = async ({
  id,
  userId,
}: PasswordResetOperation): Promise<void> =>
  await withTransaction(async (client) => {
    await lockAccountIdentity(client, userId);
    await client.query(
      `delete from account_password_reset_operations
       where id = $1 and user_id = $2`,
      [id, userId]
    );
  });

export const withAccountPasswordResetOperation = async ({
  endpoint,
  handler,
  request,
}: {
  endpoint: PasswordResetEndpoint;
  handler: () => Promise<Response>;
  request: Request;
}): Promise<Response> => {
  const operation = await beginPasswordResetOperation(request, endpoint);
  if (!operation) {
    return await handler();
  }

  try {
    return await handler();
  } finally {
    await finishPasswordResetOperation(operation);
  }
};

export const assertNoPasswordResetInProgress = async (
  client: QueryClient,
  userId: string
): Promise<void> => {
  await client.query(
    `delete from account_password_reset_operations
     where user_id = $1 and expires_at <= now()`,
    [userId]
  );
  const result = await client.query<{ id: string }>(
    `select id
     from account_password_reset_operations
     where user_id = $1
       and expires_at > now()
     limit 1
     for update`,
    [userId]
  );
  if (result.rows.length > 0) {
    throw new Error("account_password_reset_in_progress");
  }
};
