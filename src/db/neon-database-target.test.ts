import { describe, expect, it } from "vitest";
import {
  EXPECTED_NEON_TARGETS,
  getNeonTargetProblems,
  PRODUCTION_NEON_COMPUTE,
  type NeonNonProductionEnvironment,
} from "./neon-database-target";

const TARGET_KEYS = {
  development: {
    branchId: "DEVELOPMENT_NEON_BRANCH_ID",
    host: "DEVELOPMENT_DATABASE_HOST",
    projectId: "DEVELOPMENT_NEON_PROJECT_ID",
  },
  staging: {
    branchId: "STAGING_NEON_BRANCH_ID",
    host: "STAGING_DATABASE_HOST",
    projectId: "STAGING_NEON_PROJECT_ID",
  },
} as const satisfies Record<
  NeonNonProductionEnvironment,
  { branchId: string; host: string; projectId: string }
>;

const createTargetEnvironment = (
  target: NeonNonProductionEnvironment,
  overrides: Record<string, string> = {}
): Record<string, string> => {
  const expected = EXPECTED_NEON_TARGETS[target];
  const keys = TARGET_KEYS[target];
  return {
    DATABASE_URL_DIRECT: `postgresql://owner:secret@${expected.host}/${expected.databaseName}`,
    [keys.branchId]: expected.branchId,
    [keys.host]: expected.host,
    [keys.projectId]: expected.projectId,
    ...overrides,
  };
};

describe("Neon non-production database target", () => {
  it("records the approved branches created for the isolated project", () => {
    expect(EXPECTED_NEON_TARGETS).toEqual({
      development: {
        branchId: "br-square-recipe-b67a4ch7",
        branchName: "development",
        databaseName: "neondb",
        host: "ep-autumn-hill-b6erdexq.c-2.sa-east-1.aws.neon.tech",
        parentId: "br-sparkling-tree-b6c6emws",
        projectId: "shy-bar-59728129",
      },
      staging: {
        branchId: "br-cool-bread-b69twnrp",
        branchName: "staging",
        databaseName: "neondb",
        host: "ep-noisy-band-b6lcc8jk.c-2.sa-east-1.aws.neon.tech",
        parentId: "br-sparkling-tree-b6c6emws",
        projectId: "shy-bar-59728129",
      },
    });
  });

  it.each(["development", "staging"] as const)(
    "accepts the approved %s branch on its direct endpoint",
    (target) => {
      const expected = EXPECTED_NEON_TARGETS[target];
      const keys = TARGET_KEYS[target];
      const environment = createTargetEnvironment(target);

      expect(getNeonTargetProblems(environment, target)).toEqual([]);
      expect(environment[keys.branchId]).toBe(expected.branchId);
    }
  );

  it.each(["development", "staging"] as const)(
    "rejects a pooled endpoint for %s migration credentials",
    (target) => {
      const expected = EXPECTED_NEON_TARGETS[target];
      const pooledHost = expected.host.replace(".c-2.", "-pooler.c-2.");
      const environment = createTargetEnvironment(target, {
        DATABASE_URL_DIRECT: `postgresql://owner:secret@${pooledHost}/${expected.databaseName}`,
      });

      expect(getNeonTargetProblems(environment, target)).toContain(
        "DATABASE_URL_DIRECT must use the direct Neon endpoint, not a pooler"
      );
    }
  );

  it.each(["development", "staging"] as const)(
    "requires project, branch, host, and direct URL for %s",
    (target) => {
      const keys = TARGET_KEYS[target];
      expect(getNeonTargetProblems({}, target)).toEqual([
        "DATABASE_URL_DIRECT is required",
        `${keys.host} is required`,
        `${keys.projectId} is required`,
        `${keys.branchId} is required`,
      ]);
    }
  );

  it("rejects the Production compute even if every supplied ID is changed", () => {
    const target = "development";
    const expected = EXPECTED_NEON_TARGETS[target];
    const productionHost = `${PRODUCTION_NEON_COMPUTE}.sa-east-1.aws.neon.tech`;
    const environment = createTargetEnvironment(target, {
      DATABASE_URL_DIRECT: `postgresql://owner:secret@${productionHost}/neondb`,
      DEVELOPMENT_DATABASE_HOST: productionHost,
      DEVELOPMENT_NEON_BRANCH_ID: "br-dark-boat-ac5ju6m4",
    });

    expect(getNeonTargetProblems(environment, target)).toContain(
      "DATABASE_URL_DIRECT must not target the Production Neon compute"
    );
    expect(expected.host).not.toBe(productionHost);
  });

  it("rejects a different branch ID, project ID, or endpoint host", () => {
    const environment = createTargetEnvironment("staging", {
      STAGING_NEON_BRANCH_ID: "br-another-branch",
      STAGING_NEON_PROJECT_ID: "another-project",
      STAGING_DATABASE_HOST: "ep-another-compute.c-2.sa-east-1.aws.neon.tech",
      DATABASE_URL_DIRECT:
        "postgresql://owner:secret@ep-another-compute.c-2.sa-east-1.aws.neon.tech/neondb",
    });

    expect(getNeonTargetProblems(environment, "staging")).toEqual([
      "DATABASE_URL_DIRECT must target the approved staging Neon host",
      "STAGING_DATABASE_HOST must match the approved staging Neon host",
      "STAGING_NEON_PROJECT_ID does not match the approved Neon project",
      "STAGING_NEON_BRANCH_ID does not match the approved Neon branch",
    ]);
  });

  it("rejects a non-Postgres URL and a wrong database name", () => {
    const expected = EXPECTED_NEON_TARGETS.development;
    const invalidProtocol = createTargetEnvironment("development", {
      DATABASE_URL_DIRECT: `https://${expected.host}/neondb`,
    });
    const wrongDatabase = createTargetEnvironment("development", {
      DATABASE_URL_DIRECT: `postgresql://owner:secret@${expected.host}/otherdb`,
    });

    expect(
      getNeonTargetProblems(invalidProtocol, "development")
    ).toContain("DATABASE_URL_DIRECT must be a valid PostgreSQL URL");
    expect(
      getNeonTargetProblems(wrongDatabase, "development")
    ).toContain("DATABASE_URL_DIRECT must target the development database");
  });
});
