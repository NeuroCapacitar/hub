import { assertNeonDatabaseTarget } from "./neon-database-target";

export const assertStagingTarget = ({
  branchId,
  confirmation,
  databaseUrl,
  expectedHost,
  projectId,
}: {
  branchId: string | undefined;
  confirmation: string | undefined;
  databaseUrl: string;
  expectedHost: string | undefined;
  projectId: string | undefined;
}): { branchId: string; databaseName: string; host: string } => {
  if (confirmation?.trim().toLowerCase() !== "staging") {
    throw new Error("Set STAGING_OPERATION_CONFIRMATION=staging.");
  }

  const target = assertNeonDatabaseTarget({
    environment: {
      DATABASE_URL_DIRECT: databaseUrl,
      STAGING_DATABASE_HOST: expectedHost,
      STAGING_NEON_BRANCH_ID: branchId,
      STAGING_NEON_PROJECT_ID: projectId,
    },
    target: "staging",
  });

  return {
    branchId: target.branchId,
    databaseName: target.databaseName,
    host: target.host,
  };
};
