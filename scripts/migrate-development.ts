import { resolve } from "node:path";
import { config } from "dotenv";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { DEVELOPMENT_LEGACY_MIGRATIONS } from "../src/db/development-migration-compatibility";
import { applyMigrationsPerFile } from "../src/db/e2e-migrator";
import { runMigrationWithLock } from "../src/db/migration-lock";
import { assertNeonDatabaseTarget } from "../src/db/neon-database-target";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

if (process.env.DEVELOPMENT_OPERATION_CONFIRMATION?.trim() !== "development") {
  throw new Error(
    "Set DEVELOPMENT_OPERATION_CONFIRMATION=development to run this migration."
  );
}

const target = assertNeonDatabaseTarget({
  environment: process.env,
  target: "development",
});

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
      applyMigrationsPerFile({
        client: lockClient,
        legacyMigrations: DEVELOPMENT_LEGACY_MIGRATIONS,
        migrations: readMigrationFiles({ migrationsFolder }),
        // Development preserves historical journal rows whose hashes can differ
        // from the current source after non-authoritative rewrites. Drizzle's
        // normal migrator advances by applied timestamps; keep that behavior while
        // retaining one transaction and journal entry per migration file.
        verifyAppliedHashes: false,
      }),
  });
  process.stdout.write(
    `Development migrations applied to ${target.databaseName} at ${target.host}; project ${target.projectId}, branch ${target.branchId}.\n`
  );
} finally {
  await pool.end();
}
