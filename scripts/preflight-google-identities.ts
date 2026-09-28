import { createHash } from "node:crypto";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { getMigrationTargetProblems } from "../src/db/migration-target";
import { scanBuyerIdentityCollisions } from "../src/features/payments/identity-collision-audit";

config({ path: ".env.local", override: true, quiet: true });
config({ path: ".env", quiet: true });

interface DuplicateProviderIdentity {
  account_id: string;
  account_row_ids: string[];
  provider_id: string;
  user_ids: string[];
}

const hashIdentifier = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const main = async (): Promise<void> => {
  const targetProblems = getMigrationTargetProblems(process.env, "development");
  if (targetProblems.length > 0) {
    for (const problem of targetProblems) {
      process.stderr.write(`- ${problem}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL_DIRECT?.trim();
  if (!databaseUrl) {
    process.stderr.write("DATABASE_URL_DIRECT is required.\n");
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({
    application_name: "hub-development-google-identity-preflight",
    connectionString: withVerifiedSslMode(databaseUrl),
    connectionTimeoutMillis: 10_000,
    max: 1,
  });
  let client: PoolClient | undefined;
  let transactionOpen = false;

  try {
    const connection = await pool.connect();
    client = connection;
    await connection.query("begin read only");
    transactionOpen = true;
    await connection.query("set local statement_timeout = '15s'");

    const duplicateResult = await connection.query<DuplicateProviderIdentity>(`
      select
        provider_id,
        account_id,
        array_agg(id order by id) as account_row_ids,
        array_agg(user_id order by user_id) as user_ids
      from accounts
      group by provider_id, account_id
      having count(*) > 1
      order by provider_id, account_id
    `);
    const buyerCollisions = await scanBuyerIdentityCollisions({
      queryUsers: async (cursor, batchSize) => {
        const { rows } = await connection.query<{
          email: string;
          user_id: string;
        }>(
          `
            select id as user_id, email
            from users
            where id::text > $1
            order by id::text asc
            limit $2
          `,
          [cursor, batchSize]
        );
        return rows.map((row) => ({ email: row.email, userId: row.user_id }));
      },
    });

    await connection.query("rollback");
    transactionOpen = false;

    const duplicateAccounts = duplicateResult.rows.map((row) => ({
      accountIdSha256: hashIdentifier(row.account_id),
      accountRowIds: row.account_row_ids,
      providerId: row.provider_id,
      userIds: row.user_ids,
    }));
    const buyerIdentityCollisionGroups = buyerCollisions.map((collision) => ({
      canonicalEmailSha256: hashIdentifier(collision.canonicalEmail),
      userIds: collision.userIds,
    }));
    const safeToApply =
      duplicateAccounts.length === 0 &&
      buyerIdentityCollisionGroups.length === 0;

    process.stdout.write(
      `${JSON.stringify({
        environment: "development",
        generatedAt: new Date().toISOString(),
        safeToApply,
        duplicateAccounts,
        buyerIdentityCollisionGroups,
      })}\n`
    );
    if (!safeToApply) {
      process.exitCode = 2;
    }
  } catch {
    if (client && transactionOpen) {
      await client.query("rollback").catch(() => undefined);
    }
    process.stderr.write(
      "Development identity preflight failed; no rows were changed.\n"
    );
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
};

if (import.meta.main) {
  await main();
}
