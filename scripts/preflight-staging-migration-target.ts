import { config } from "dotenv";
import { assertStagingTarget } from "../src/db/staging-target";

config({ path: ".env.local", override: true, quiet: true });
config({ path: ".env", quiet: true });

const databaseUrl = process.env.DATABASE_URL_DIRECT?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL_DIRECT is required for Staging preflight.");
}

const target = assertStagingTarget({
  branchId: process.env.STAGING_NEON_BRANCH_ID,
  confirmation: process.env.STAGING_OPERATION_CONFIRMATION,
  databaseUrl,
  expectedHost: process.env.STAGING_DATABASE_HOST,
  projectId: process.env.STAGING_NEON_PROJECT_ID,
});

process.stdout.write(
  `Staging Neon migration target validated: ${target.databaseName} at ${target.host}; branch ${target.branchId}.\n`
);
