import "server-only";
import { createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import { getServerEnv } from "@/lib/env";

type RateLimitClient = Pick<PoolClient, "query">;

export const consumeAccountRateLimit = async ({
  client,
  key,
  limit,
  namespace,
  windowMs,
}: {
  client: RateLimitClient;
  key: string;
  limit: number;
  namespace: string;
  windowMs: number;
}): Promise<boolean> => {
  const keyHash = createHmac("sha256", getServerEnv().BETTER_AUTH_SECRET)
    .update(`${namespace}\0`)
    .update(key)
    .digest("hex");
  const result = await client.query<{ request_count: number }>(
    `
      insert into account_email_challenge_rate_limits (
        key_hash,
        window_started_at,
        request_count,
        expires_at
      )
      values ($1, now(), 1, now() + ($2 * interval '1 millisecond'))
      on conflict (key_hash) do update set
        window_started_at = case
          when account_email_challenge_rate_limits.expires_at <= now() then now()
          else account_email_challenge_rate_limits.window_started_at
        end,
        request_count = case
          when account_email_challenge_rate_limits.expires_at <= now() then 1
          else account_email_challenge_rate_limits.request_count + 1
        end,
        expires_at = case
          when account_email_challenge_rate_limits.expires_at <= now()
            then now() + ($2 * interval '1 millisecond')
          else account_email_challenge_rate_limits.expires_at
        end,
        updated_at = now()
      returning request_count
    `,
    [keyHash, windowMs]
  );
  return (result.rows[0]?.request_count ?? Number.MAX_SAFE_INTEGER) <= limit;
};
