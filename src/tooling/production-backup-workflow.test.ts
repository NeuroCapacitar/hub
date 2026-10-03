import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const workflowPath = join(
  root,
  ".github/workflows/backup-production-database.yml"
);
const deployWorkflowPath = join(root, ".github/workflows/deploy-vercel.yml");
const packagePath = join(root, "package.json");
const CRON_PATTERN = /cron:\s*["']([^"']+)["']/g;
const githubVariableReference = (name: string): string =>
  `${name}: ${String.fromCharCode(36)}{{ vars.${name} }}`;

describe("production database backup workflow", () => {
  it("binds operational code to the approved event SHA and isolates secrets from install steps", async () => {
    const source = await readFile(workflowPath, "utf8");
    expect(source).toContain("if: github.ref == 'refs/heads/main'");
    expect(source).toContain(`ref: ${String.fromCharCode(36)}{{ github.sha }}`);
    expect(source).toContain("persist-credentials: false");
    const preparation = source.slice(
      0,
      source.indexOf("- name: Create encrypted Production backup")
    );
    expect(preparation).not.toContain("secrets.");
    expect(preparation.indexOf("Verify approved backup source")).toBeLessThan(
      preparation.indexOf("Install frozen dependencies")
    );
    const cleanup = await readFile(
      join(root, ".github/workflows/cleanup-neon-release-backups.yml"),
      "utf8"
    );
    expect(cleanup).toContain(
      "inputs.environment == 'production' && github.ref == 'refs/heads/main'"
    );
    expect(cleanup).toContain(
      "inputs.environment == 'staging' && github.ref == 'refs/heads/staging'"
    );
    expect(
      cleanup.slice(
        0,
        cleanup.indexOf("- name: Run approved release-backup cleanup")
      )
    ).not.toContain("secrets.");
  });
  it("keeps one literal six-hour schedule synchronized with the public cadence", async () => {
    const source = await readFile(workflowPath, "utf8");
    const crons = [...source.matchAll(CRON_PATTERN)].map((match) => match[1]);
    expect(crons).toEqual(["17 */6 * * *"]);
    expect(source).toContain('BACKUP_CADENCE_HOURS: "6"');
    expect(source).toContain("workflow_dispatch:");
  });

  it("uses the protected environment, dedicated inputs and non-cancelling concurrency", async () => {
    const source = await readFile(workflowPath, "utf8");
    expect(source).toContain("environment: production-backup");
    expect(source).toContain("group: production-database-backup");
    expect(source).toContain("cancel-in-progress: false");
    expect(source).toContain("contents: read");
    expect(source).toContain("timeout-minutes:");
    for (const name of [
      "BACKUP_DATABASE_URL",
      "PGSSLROOTCERT",
      "BACKUP_R2_ACCESS_KEY_ID",
      "BACKUP_R2_SECRET_ACCESS_KEY",
      "BACKUP_R2_ACCOUNT_ID",
      "BACKUP_R2_BUCKET_NAME",
      "BACKUP_AGE_RECIPIENT",
      "PRODUCTION_DATABASE_HOST",
      "PRODUCTION_NEON_BRANCH_ID",
      "PRODUCTION_NEON_PROJECT_ID",
      "NEON_API_KEY",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
      "VERCEL_TOKEN",
    ]) {
      expect(source).toContain(name);
    }
  });

  it("pins Bun and age, verifies PostgreSQL 18 and never uploads backup artifacts", async () => {
    const source = await readFile(workflowPath, "utf8");
    expect(source).toContain("bun-version: 1.3.11");
    expect(source).toContain("age-v1.3.1-linux-amd64.tar.gz");
    expect(source).toContain(
      "bdc69c09cbdd6cf8b1f333d372a1f58247b3a33146406333e30c0f26e8f51377"
    );
    expect(source).toContain("postgresql-client-18");
    expect(source).toContain(
      `export PATH="/usr/lib/postgresql/18/bin:\${PATH}"`
    );
    expect(source).toContain(
      'echo "/usr/lib/postgresql/18/bin" >> "$GITHUB_PATH"'
    );
    expect(source).toContain("pg_dump --version");
    expect(source).toContain("age --version");
    expect(source).not.toContain("upload-artifact");
    expect(source).toContain("bun install --frozen-lockfile");
    expect(source).toContain("bun run ops:backup:production");
    expect(source).toContain("command -v pg_dump");
    expect(source).toContain("command -v pg_restore");
  });

  it("exposes only the guarded backup entrypoint in package scripts", async () => {
    const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["ops:backup:production"]).toBe(
      "bun scripts/create-production-backup.ts"
    );
  });

  it("passes Production Neon identity to the freshness guard", async () => {
    const source = await readFile(deployWorkflowPath, "utf8");
    const freshnessStep = source.slice(
      source.indexOf("- name: Require a recent independent Production backup"),
      source.indexOf("- name: Set Production backup expiry")
    );

    expect(freshnessStep).toContain(
      githubVariableReference("PRODUCTION_NEON_BRANCH_ID")
    );
    expect(freshnessStep).toContain(
      githubVariableReference("PRODUCTION_NEON_PROJECT_ID")
    );
  });
});
