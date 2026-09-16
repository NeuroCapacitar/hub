import { resolve } from "node:path";
import { config } from "dotenv";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { applyMigrationsPerFile } from "../src/db/e2e-migrator";
import { runMigrationWithLock } from "../src/db/migration-lock";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const directDatabaseUrl = process.env.DATABASE_URL_DIRECT?.trim();
if (!directDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_DIRECT is required for the production migration job."
  );
}

const pool = new Pool({
  application_name: "protea-r-migration",
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
        migrations: readMigrationFiles({ migrationsFolder }),
      }),
  });
  process.stdout.write("Production migrations applied.\n");
} finally {
  await pool.end();
}
