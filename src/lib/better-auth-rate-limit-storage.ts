import "server-only";
import { createHmac } from "node:crypto";
import { getPool } from "@/db";
import { getServerEnv } from "@/lib/env";

interface BetterAuthRateLimitRule {
  max: number;
  window: number;
}

const hashRateLimitKey = (key: string): string =>
  createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update("hub:better-auth-rate-limit:v1\0")
    .update(key)
    .digest("hex");

export const consumeBetterAuthRateLimit = async (
  key: string,
  rule: BetterAuthRateLimitRule
): Promise<{ allowed: boolean; retryAfter: number | null }> => {
  if (
    !Number.isSafeInteger(rule.max) ||
    rule.max < 1 ||
    !Number.isFinite(rule.window) ||
    rule.window <= 0
  ) {
    throw new Error("Invalid Better Auth rate-limit rule.");
  }

  const keyHash = hashRateLimitKey(key);
  const consumed = await getPool().query<{ request_count: number }>(
    `
      insert into better_auth_rate_limits (
        key_hash,
        last_request_at,
        request_count,
        expires_at
      )
      values ($1, now(), 1, now() + ($2 * interval '1 second'))
      on conflict (key_hash) do update set
        last_request_at = now(),
        request_count = case
          when better_auth_rate_limits.expires_at <= now() then 1
          else better_auth_rate_limits.request_count + 1
        end,
        expires_at = now() + ($2 * interval '1 second'),
        updated_at = now()
      where better_auth_rate_limits.expires_at <= now()
         or better_auth_rate_limits.request_count < $3
      returning request_count
    `,
    [keyHash, rule.window, rule.max]
  );

  if (consumed.rows[0]) {
    return { allowed: true, retryAfter: null };
  }

  const current = await getPool().query<{ retry_after: number }>(
    `
      select greatest(
        1,
        ceil(extract(epoch from (expires_at - now())))
      )::int as retry_after
      from better_auth_rate_limits
      where key_hash = $1
      limit 1
    `,
    [keyHash]
  );

  return {
    allowed: false,
    retryAfter: current.rows[0]?.retry_after ?? Math.ceil(rule.window),
  };
};
