import "server-only";
import type { PoolClient } from "pg";

type AccountIdentityLockClient = Pick<PoolClient, "query">;

export const lockAccountIdentity = async (
  client: AccountIdentityLockClient,
  userId: string
): Promise<void> => {
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `account-email-change:${userId}`,
  ]);
};
