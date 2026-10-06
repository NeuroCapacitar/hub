import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkflow = (fileName: string): string =>
  readFileSync(
    resolve(import.meta.dirname, `../../.github/workflows/${fileName}`),
    "utf8"
  );

const readRepositoryFile = (fileName: string): string =>
  readFileSync(resolve(import.meta.dirname, `../../${fileName}`), "utf8");

const DEPENDABOT_UPDATE_BLOCK_PATTERN = /\n\s{2}- package-ecosystem:/;
const EMPTY_STAGING_WORKER_ENV_PATTERN =
  /name: Invoke authenticated Staging workers[\r\n]+\s+env:\s*[\r\n]+\s+run:/;
const RELEASE_BACKUP_CLEANUP_JOB_GATE_PATTERN =
  /jobs:\r?\n {2}manual:\r?\n {4}if: >-\r?\n {6}\(inputs\.environment == 'staging' && github\.ref == 'refs\/heads\/staging'\) \|\|\r?\n {6}\(inputs\.environment == 'production' && github\.ref == 'refs\/heads\/main'\)/;
const RELEASE_BACKUP_CLEANUP_CHECKOUT_PATTERN =
  /uses: actions\/checkout@[^\r\n]+\r?\n {8}with:\r?\n {10}fetch-depth: 1\r?\n {10}ref: \$\{\{ github\.sha \}\}/;

describe("CI and deployment workflow contracts", () => {
  it("routes every Dependabot update to Staging", () => {
    const source = readRepositoryFile(".github/dependabot.yml");
    const updateBlocks = source.split(DEPENDABOT_UPDATE_BLOCK_PATTERN).slice(1);

    expect(updateBlocks).toHaveLength(2);
    for (const block of updateBlocks) {
      expect(block).toContain("target-branch: staging");
    }
  });

  it("keeps the manual Staging jobs workflow schema-valid", () => {
    const source = readWorkflow("run-staging-jobs.yml");
    expect(source).not.toMatch(EMPTY_STAGING_WORKER_ENV_PATTERN);
  });

  it("uses an expiring no-compute helper for temporary Neon recovery branches", () => {
    for (const workflowName of [
      "deploy-vercel.yml",
      "reset-staging.yml",
      "cleanup-production-test-data.yml",
    ]) {
      const source = readWorkflow(workflowName);
      expect(source).toContain("scripts/create-neon-recovery-branch.ts");
      expect(source).not.toContain("neondatabase/create-branch-action");
      expect(source).toContain("NEON_EXPIRES_AT");
    }
  });

  it("selects the cleanup project from the selected Neon environment", () => {
    const source = readWorkflow("cleanup-neon-release-backups.yml");
    const expression = [
      "NEON_RELEASE_PROJECT_ID: ",
      String.fromCharCode(36),
      "{{ inputs.environment == 'staging' && vars.STAGING_NEON_PROJECT_ID || vars.PRODUCTION_NEON_PROJECT_ID }}",
    ].join("");
    expect(source).toContain(expression);
  });

  it("binds cleanup secrets only to the matching persistent event and checkout branch", () => {
    const source = readWorkflow("cleanup-neon-release-backups.yml");

    expect(source).toMatch(RELEASE_BACKUP_CLEANUP_JOB_GATE_PATTERN);
    expect(source).toMatch(RELEASE_BACKUP_CLEANUP_CHECKOUT_PATTERN);
  });

  it("runs CI only for pull requests and manual verification", () => {
    const workflow = readWorkflow("ci.yml");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("branches: [main, staging]");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("name: CI");
    expect(workflow).not.toContain("\n  push:");
    expect(workflow).not.toContain("NEON_CI_API_KEY");
    expect(workflow).not.toContain("create-neon-branch");
    expect(workflow).not.toContain("delete-neon-branch");
    expect(workflow.match(/bun install --frozen-lockfile/g)).toHaveLength(1);
  });

  it("runs integration and E2E against separate local PostgreSQL databases", () => {
    const workflow = readWorkflow("ci.yml");

    expect(workflow).toContain("services:");
    expect(workflow).toContain("postgres:18-alpine");
    expect(workflow).toContain("create database hub_integration");
    expect(workflow).toContain("create database hub_e2e");
    expect(workflow).toContain(
      "postgresql://postgres:postgres@127.0.0.1:5432/hub_integration?sslmode=disable"
    );
    expect(workflow).toContain(
      "postgresql://postgres:postgres@127.0.0.1:5432/hub_e2e?sslmode=disable"
    );
    expect(workflow).toContain("bun run db:migrate:e2e");
    expect(workflow).toContain("bun run test:certificates:integration");
    expect(workflow).toContain("bun run test:e2e");
    expect(workflow).toContain("bun run build");
    expect(workflow).toContain("bun run knip");
  });

  it("binds the Staging deploy to its migration SHA and gates webhook smoke until maintenance is off", () => {
    const workflow = readWorkflow("deploy-staging.yml");

    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches: [staging]");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("workflow_run:");
    expect(workflow).toContain("bun run db:migrate:staging");
    expect(workflow).toContain("STAGING_TARGET_READY");
    expect(workflow).toContain("needs: migrate");
    expect(workflow).toContain(
      "migrated_sha: " +
        String.fromCharCode(36) +
        "{{ steps.verify_target.outputs.sha }}"
    );
    expect(workflow).toContain(
      "ref: " +
        String.fromCharCode(36) +
        "{{ needs.migrate.outputs.migrated_sha }}"
    );
    expect(workflow).toContain("MIGRATED_STAGING_SHA");
    expect(workflow).toContain(
      "Reconfirm the migrated Staging SHA immediately before deploy"
    );
    expect(workflow).toContain("inputs.confirm_maintenance_off == true");
    expect(workflow).toContain("vercel@57.0.0 deploy --prebuilt");
    expect(workflow).toContain("preview.neurocapacitar.com.br");
    expect(workflow).toContain("api/health/ready");

    const verifyStart = workflow.indexOf("  verify:");
    expect(verifyStart).toBeGreaterThanOrEqual(0);
    const deployBlock = workflow.slice(
      workflow.indexOf("  deploy:"),
      verifyStart
    );
    const verifyBlock = workflow.slice(verifyStart);
    expect(deployBlock).not.toContain("/api/webhooks/resend");
    expect(verifyBlock).toContain("/api/webhooks/resend");
  });

  it("creates a reconciliation PR when main contains Production-only changes", () => {
    const workflow = readWorkflow("prepare-production-release.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("name: vercel-staging");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("sync/production-into-staging-");
    expect(workflow).toContain("git merge --no-edit origin/main");
    expect(workflow).toContain("git merge --abort");
    expect(workflow).toContain("gh workflow run ci.yml");
    expect(workflow).toContain(
      "vercel@57.0.0 inspect preview.neurocapacitar.com.br"
    );
    expect(workflow).not.toContain("api.vercel.com/v13/deployments");
    expect(workflow).toContain("--base staging");
    expect(workflow).toContain("gh pr create");
  });

  it("releases Staging or a validated hotfix and never skips the staged Production deployment", () => {
    const workflow = readWorkflow("deploy-vercel.yml");

    expect(workflow).toContain("mode:");
    expect(workflow).toContain("release-staging");
    expect(workflow).toContain("hotfix");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("git push origin");
    expect(workflow).toContain("Await automatic Production deployment");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain(
      "name: Require a recent independent Production backup"
    );
    expect(workflow).toContain(
      "if: steps.release.outputs.has_migrations == 'true'"
    );
    expect(workflow).not.toContain("release_sha:");
    expect(workflow).not.toContain("confirm_production:");
    expect(workflow).not.toContain("EMERGENCY_SKIP_PRODUCTION");
    expect(workflow).not.toContain("candidate_ci_head_sha");
    expect(workflow).toContain(
      "No successful CI check exists for the exact Staging candidate SHA."
    );
  });

  it("verifies the exact current Vercel Staging alias before Production release", () => {
    const workflow = readWorkflow("deploy-vercel.yml");
    const verifyStart = workflow.indexOf("  verify_staging:");
    const deployStart = workflow.indexOf("  deploy:");
    const verifyBlock = workflow.slice(verifyStart, deployStart);

    expect(verifyStart).toBeGreaterThanOrEqual(0);
    expect(deployStart).toBeGreaterThan(verifyStart);
    expect(verifyBlock).toContain(
      "vercel@57.0.0 inspect preview.neurocapacitar.com.br"
    );
    expect(verifyBlock).toContain("vercel@57.0.0 list hub");
    expect(verifyBlock).toContain("--environment=preview");
    expect(verifyBlock).toContain("--status=READY");
    expect(verifyBlock).toContain("meta.githubCommitSha");
    expect(verifyBlock).toContain("staging_alias_metadata");
    expect(verifyBlock).toContain("Vercel records=");
    expect(verifyBlock).toContain("api/health/ready");
    expect(verifyBlock).toContain("api/webhooks/resend");
    expect(verifyBlock).not.toContain("/deployments?sha=");
    expect(verifyBlock).not.toContain('creator.login == "vercel[bot]"');
  });

  it("keeps the JMVStream schedule at thirty minutes", () => {
    const vercel = readFileSync(
      resolve(import.meta.dirname, "../../vercel.json"),
      "utf8"
    );
    const stagingJobs = readWorkflow("run-staging-jobs.yml");

    expect(vercel).toContain('"path": "/api/cron/jmvstream"');
    expect(vercel).toContain('"schedule": "15,45 * * * *"');
    expect(stagingJobs).toContain('call_job "/api/cron/jmvstream"');
    expect(stagingJobs).not.toContain('cron: "*/5 * * * *"');
  });

  it("ties destructive Production cleanup to the current main CI check", () => {
    const workflow = readWorkflow("cleanup-production-test-data.yml");

    expect(workflow).toContain("checks: read");
    expect(workflow).toContain("check-runs?check_name=CI");
    expect(workflow).toContain(
      [
        "commits/",
        String.fromCharCode(36),
        "{release_sha}",
        "/check-runs?check_name=CI",
      ].join("")
    );
    expect(workflow).not.toContain("actions/workflows/ci.yml/runs?branch=main");
    expect(workflow).not.toContain("candidate_ci_head_sha");
  });

  it("keeps Development migrations tied to the current main CI check", () => {
    const workflow = readWorkflow("migrate-development.yml");

    expect(workflow).toContain("checks: read");
    expect(workflow).toContain("check-runs?check_name=CI");
    expect(workflow).toContain(
      [
        "commits/",
        String.fromCharCode(36),
        "{release_sha}",
        "/check-runs?check_name=CI",
      ].join("")
    );
    expect(workflow).toContain(
      "No successful CI check exists for the exact current main SHA."
    );
    expect(workflow).not.toContain("candidate_ci_head_sha");
  });

  it("pins every migrated workflow to the valid setup-bun commit", () => {
    const setupBunRef =
      "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6";

    for (const workflowName of [
      "cleanup-neon-release-backups.yml",
      "deploy-staging.yml",
      "deploy-vercel.yml",
      "prepare-production-release.yml",
    ]) {
      expect(readWorkflow(workflowName)).toContain(setupBunRef);
    }
  });
});

describe("Production Sentry readiness workflow", () => {
  it("requires explicit confirmation and checks the emitted Production event", () => {
    const workflow = readWorkflow("verify-production-sentry.yml");

    expect(workflow).toContain("name: Verify Sentry Production readiness");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("release_sha:");
    expect(workflow).toContain("confirmation:");
    expect(workflow).toContain(
      [
        "CONFIRMATION: ",
        String.fromCharCode(36),
        "{{ inputs.confirmation }}",
      ].join("")
    );
    expect(workflow).toContain("EMIT_SENTRY_PRODUCTION_READINESS");
    expect(workflow).toContain("name: vercel-production");
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain(
      "PRODUCTION_ORIGIN: https://app.neurocapacitar.com.br"
    );
    expect(workflow).toContain("SENTRY_READINESS_SECRET");
    expect(workflow).toContain("SENTRY_READINESS_AUTH_TOKEN");
    expect(workflow).toContain("bun run ops:check:sentry-readiness");
    expect(workflow).toContain("--environment=production");
    expect(workflow).not.toContain("vercel deploy");
  });
});

describe("CI artifact retention", () => {
  it("expires Playwright artifacts after fourteen days", () => {
    const workflow = readWorkflow("ci.yml");
    const artifactStart = workflow.indexOf("name: Upload Playwright report");
    const artifactEnd = workflow.indexOf(
      "name: Build with synthetic CI configuration",
      artifactStart
    );

    expect(artifactStart).toBeGreaterThanOrEqual(0);
    expect(artifactEnd).toBeGreaterThan(artifactStart);
    expect(workflow.slice(artifactStart, artifactEnd)).toContain(
      "retention-days: 14"
    );
  });
});
