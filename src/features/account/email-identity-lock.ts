import type { PoolClient } from "pg";
import { normalizeBuyerEmail } from "@/lib/email-identity";

type AdvisoryLockClient = Pick<PoolClient, "query">;

const lockCanonicalIdentity = async (
  client: AdvisoryLockClient,
  canonicalEmail: string
): Promise<void> => {
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `account-email:${canonicalEmail}`,
  ]);
};

export const lockAccountEmailIdentities = async (
  client: AdvisoryLockClient,
  emails: readonly string[]
): Promise<string[]> => {
  const identities = [...new Set(emails.map(normalizeBuyerEmail))].sort();
  for (const identity of identities) {
    await lockCanonicalIdentity(client, identity);
  }
  return identities;
};

export const lockAccountEmailIdentity = async (
  client: AdvisoryLockClient,
  email: string
): Promise<string> => {
  const canonicalEmail = normalizeBuyerEmail(email);
  await lockCanonicalIdentity(client, canonicalEmail);
  return canonicalEmail;
};
