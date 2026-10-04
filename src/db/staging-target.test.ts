import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED_NEON_TARGETS } from "./neon-database-target";
import { assertStagingTarget } from "./staging-target";

const expected = EXPECTED_NEON_TARGETS.staging;
const STAGING_URL = `postgresql://user:secret@${expected.host}/${expected.databaseName}`;
const createStagingTarget = (
  overrides: Partial<{
    branchId: string;
    confirmation: string;
    databaseUrl: string;
    expectedHost: string;
    projectId: string;
  }> = {}
) => ({
  branchId: expected.branchId,
  confirmation: "staging",
  databaseUrl: STAGING_URL,
  expectedHost: expected.host,
  projectId: expected.projectId,
  ...overrides,
});

describe("Staging database target", () => {
  it("accepts the explicitly confirmed Staging compute", () => {
    expect(
      assertStagingTarget(createStagingTarget())
    ).toEqual({
      branchId: expected.branchId,
      databaseName: "neondb",
      host: expected.host,
    });
  });

  it("rejects Production, wrong branch, and weak confirmation", () => {
    expect(() =>
      assertStagingTarget(
        createStagingTarget({
          databaseUrl:
            "postgresql://user:do-not-print@ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech/neondb",
        })
      )
    ).toThrow("DATABASE_URL_DIRECT must not target the Production Neon compute");
    expect(() =>
      assertStagingTarget(createStagingTarget({ branchId: "br-other" }))
    ).toThrow("STAGING_NEON_BRANCH_ID does not match the approved Neon branch");
    expect(() =>
      assertStagingTarget(createStagingTarget({ confirmation: "production" }))
    ).toThrow("Set STAGING_OPERATION_CONFIRMATION=staging.");
  });

  it("keeps Staging operational scripts on the guarded direct target", () => {
    for (const script of [
      "scripts/migrate-staging.ts",
      "scripts/seed-staging-admin.ts",
      "scripts/reset-staging.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), script), "utf8");
      expect(source).toContain("DATABASE_URL_DIRECT");
      expect(source).toContain("STAGING_DATABASE_HOST");
      expect(source).toContain("STAGING_NEON_BRANCH_ID");
      expect(source).toContain("STAGING_NEON_PROJECT_ID");
      expect(source).toContain("STAGING_OPERATION_CONFIRMATION");
      expect(source).toContain("assertStagingTarget");
    }
  });

  it("requires explicit reset mode and both execute confirmations", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/reset-staging.ts"),
      "utf8"
    );

    expect(source).toContain("--mode=plan");
    expect(source).toContain("--mode=execute");
    expect(source).toContain("--environment=staging");
    expect(source).toContain("--confirm-reset=true");
    expect(source).toContain("--confirmation=RESET_STAGING_DATA");
    expect(source).toContain("__drizzle_migrations");
    expect(source).toContain("RESTART IDENTITY CASCADE");
    expect(source).toContain("rollback");
  });
});
