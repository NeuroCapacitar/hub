import { resolve } from "node:path";
import { config } from "dotenv";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { applyE2eMigrationsPerFile } from "../src/db/e2e-migrator";
import { runMigrationWithLock } from "../src/db/migration-lock";
import { getMigrationTargetProblems } from "../src/db/migration-target";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const problems = getMigrationTargetProblems(process.env, "development");
if (problems.length > 0) {
  throw new Error(
    `Development migration target is unsafe:\n- ${problems.join("\n- ")}`
  );
}

const directDatabaseUrl = process.env.DATABASE_URL_DIRECT?.trim();
if (!directDatabaseUrl) {
  throw new Error("DATABASE_URL_DIRECT is required.");
}

const pool = new Pool({
  application_name: "protea-r-development-migration",
  connectionString: withVerifiedSslMode(directDatabaseUrl),
  connectionTimeoutMillis: 10_000,
  max: 2,
});
const lockClient = await pool.connect();
const migrationsFolder =
  process.env.MIGRATIONS_FOLDER ?? resolve(process.cwd(), "src/db/migrations");

try {
  await runMigrationWithLock({
    client: lockClient,
    migrate: () =>
      applyE2eMigrationsPerFile({
        client: lockClient,
        migrations: readMigrationFiles({ migrationsFolder }),
        // Development preserves historical journal rows whose hashes can differ
        // from the current source after non-authoritative rewrites. Drizzle's
        // normal migrator advances by applied timestamps; keep that behavior while
        // retaining one transaction and journal entry per migration file.
        verifyAppliedHashes: false,
      }),
  });
  process.stdout.write("Development migrations applied.\n");
} finally {
  await pool.end();
}
