import { describe, expect, it } from "vitest";
import { EXPECTED_NEON_TARGETS } from "../db/neon-database-target";
import { assertSharedDevelopmentDatabase } from "./shared-development-database";

const expected = EXPECTED_NEON_TARGETS.development;

const createSeedTarget = (
  overrides: Partial<{
    branchId: string;
    confirmation: string | undefined;
    databaseUrl: string;
    expectedHost: string;
    projectId: string;
  }> = {}
) => ({
  branchId: expected.branchId,
  confirmation: "development",
  databaseUrl: `postgresql://owner:secret@${expected.host}/${expected.databaseName}`,
  expectedHost: expected.host,
  projectId: expected.projectId,
  ...overrides,
});

describe("shared Development database target", () => {
  it("accepts the approved target branch and returns no credentials", () => {
    expect(assertSharedDevelopmentDatabase(createSeedTarget())).toEqual({
      databaseName: "neondb",
      host: expected.host,
    });
  });

  it("rejects the Production compute without exposing credentials", () => {
    const databaseUrl =
      "postgresql://owner:super-secret@ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech/neondb";

    try {
      assertSharedDevelopmentDatabase(
        createSeedTarget({ databaseUrl, expectedHost: expected.host })
      );
      throw new Error("Expected Production target to be rejected.");
    } catch (error) {
      expect((error as Error).message).toContain(
        "DATABASE_URL_DIRECT must not target the Production Neon compute"
      );
      expect((error as Error).message).not.toContain("super-secret");
    }
  });

  it("rejects a different project, branch, or host", () => {
    expect(() =>
      assertSharedDevelopmentDatabase(
        createSeedTarget({
          branchId: "br-wrong-branch",
          projectId: "wrong-project",
        })
      )
    ).toThrow(
      "DEVELOPMENT_NEON_PROJECT_ID does not match the approved Neon project"
    );

    expect(() =>
      assertSharedDevelopmentDatabase(
        createSeedTarget({
          branchId: "br-wrong-branch",
          projectId: expected.projectId,
        })
      )
    ).toThrow(
      "DEVELOPMENT_NEON_BRANCH_ID does not match the approved Neon branch"
    );

    expect(() =>
      assertSharedDevelopmentDatabase(
        createSeedTarget({ expectedHost: "ep-other.sa-east-1.aws.neon.tech" })
      )
    ).toThrow(
      "DEVELOPMENT_DATABASE_HOST must match the approved development Neon host"
    );
  });

  it("rejects a missing seed confirmation", () => {
    expect(() =>
      assertSharedDevelopmentDatabase(
        createSeedTarget({ confirmation: undefined })
      )
    ).toThrow(
      "Set SHARED_DEVELOPMENT_SEED_CONFIRMATION=development to run this seed."
    );
  });
});
