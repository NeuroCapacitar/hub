import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { withPostgresTransaction } from "@/db/transaction";
import { lockAccountIdentity } from "@/features/account/account-identity-lock";
import { consumeAccountRateLimit } from "@/features/account/account-rate-limits";
import { getClientIpAddress } from "@/lib/client-ip";
import { normalizeBuyerEmail } from "@/lib/email-identity";
import { getServerEnv } from "@/lib/env";

const PASSWORD_RESET_OPERATION_TTL_MINUTES = 15;
const MAX_RESET_TOKEN_LENGTH = 256;
const PASSWORD_RESET_EMAIL_LIMIT = 3;
const PASSWORD_RESET_IP_LIMIT = 10;
const PASSWORD_RESET_TOKEN_LIMIT = 10;
const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const PASSWORD_RESET_RATE_LIMIT_NAMESPACE = "hub:password-reset-rate-limit:v1";
// Masks the extra user-scoped guard work before Better Auth returns its neutral response.
const PUBLIC_PASSWORD_RESET_RESPONSE_FLOOR_MS = 250;
const PASSWORD_RESET_RATE_LIMITED_RESPONSE_HEADERS = {
  "cache-control": "no-store",
};

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

type BeginPasswordResetResult =
  | { operation: null; rateLimited: true }
  | { operation: PasswordResetOperation | null; rateLimited: false };

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

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
  const bodyRecord = asRecord(body);

  if (endpoint === "request-password-reset") {
    const email = bodyRecord?.email;
    if (
      typeof email !== "string" ||
      email.length > 320 ||
      !email.includes("@")
    ) {
      return null;
    }
    return { email: normalizeBuyerEmail(email), endpoint };
  }

  const bodyToken = bodyRecord?.token;
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

const isPasswordResetRateLimited = async ({
  client,
  intent,
  request,
}: {
  client: QueryClient;
  intent: PasswordResetIntent | null;
  request: Request;
}): Promise<boolean> => {
  const env = getServerEnv();
  const clientIp = getClientIpAddress(request.headers, env.CLIENT_IP_SOURCE);
  if (clientIp === "unknown" && env.NODE_ENV === "production") {
    return true;
  }

  const multiplier = env.E2E_TEST_MODE ? 100 : 1;
  const ipAllowed = await consumeAccountRateLimit({
    client,
    key: `ip:${intent?.endpoint ?? "invalid"}:${clientIp}`,
    limit: PASSWORD_RESET_IP_LIMIT * multiplier,
    namespace: PASSWORD_RESET_RATE_LIMIT_NAMESPACE,
    windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  });

  let identityAllowed = true;
  if (intent?.endpoint === "request-password-reset" && intent.email) {
    identityAllowed = await consumeAccountRateLimit({
      client,
      key: `email:${intent.email}`,
      limit: PASSWORD_RESET_EMAIL_LIMIT * multiplier,
      namespace: PASSWORD_RESET_RATE_LIMIT_NAMESPACE,
      windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    });
  } else if (intent?.endpoint === "reset-password" && intent.token) {
    identityAllowed = await consumeAccountRateLimit({
      client,
      key: `token:${intent.token}`,
      limit: PASSWORD_RESET_TOKEN_LIMIT * multiplier,
      namespace: PASSWORD_RESET_RATE_LIMIT_NAMESPACE,
      windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    });
  }

  return !(ipAllowed && identityAllowed);
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
): Promise<BeginPasswordResetResult> => {
  const intent = await getPasswordResetIntent(request, endpoint);

  return await withPostgresTransaction(async (client) => {
    if (await isPasswordResetRateLimited({ client, intent, request })) {
      return { operation: null, rateLimited: true };
    }
    if (!intent) {
      return { operation: null, rateLimited: false };
    }

    const userId = await findCandidateUserId(client, intent);
    if (!userId) {
      return { operation: null, rateLimited: false };
    }

    await lockAccountIdentity(client, userId);
    if (!(await isPasswordResetIntentCurrent(client, intent, userId))) {
      return { operation: null, rateLimited: false };
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
    return { operation: { id, userId }, rateLimited: false };
  });
};

const finishPasswordResetOperation = async ({
  id,
  userId,
}: PasswordResetOperation): Promise<void> =>
  await withPostgresTransaction(async (client) => {
    await lockAccountIdentity(client, userId);
    await client.query(
      `delete from account_password_reset_operations
       where id = $1 and user_id = $2`,
      [id, userId]
    );
  });

const createRateLimitedResponse = (
  endpoint: PasswordResetEndpoint
): Response =>
  endpoint === "request-password-reset"
    ? Response.json(
        { status: true },
        { headers: PASSWORD_RESET_RATE_LIMITED_RESPONSE_HEADERS }
      )
    : Response.json(
        { code: "RATE_LIMITED" },
        {
          headers: PASSWORD_RESET_RATE_LIMITED_RESPONSE_HEADERS,
          status: 429,
        }
      );

const waitForPublicResetResponseFloor = async (
  startedAt: number
): Promise<void> => {
  const remainingMs =
    PUBLIC_PASSWORD_RESET_RESPONSE_FLOOR_MS - (performance.now() - startedAt);
  if (remainingMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remainingMs));
  }
};

export const withAccountPasswordResetOperation = async ({
  endpoint,
  handler,
  request,
}: {
  endpoint: PasswordResetEndpoint;
  handler: () => Promise<Response>;
  request: Request;
}): Promise<Response> => {
  const startedAt = performance.now();
  try {
    const beginResult = await beginPasswordResetOperation(request, endpoint);
    if (beginResult.rateLimited) {
      return createRateLimitedResponse(endpoint);
    }

    const operation = beginResult.operation;
    if (!operation) {
      return await handler();
    }

    try {
      return await handler();
    } finally {
      await finishPasswordResetOperation(operation);
    }
  } finally {
    if (endpoint === "request-password-reset") {
      await waitForPublicResetResponseFloor(startedAt);
    }
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
