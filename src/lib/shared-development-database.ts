import { assertNeonDatabaseTarget } from "../db/neon-database-target";

export const assertSharedDevelopmentDatabase = ({
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
}): { databaseName: string; host: string } => {
  if (confirmation?.trim().toLowerCase() !== "development") {
    throw new Error(
      "Set SHARED_DEVELOPMENT_SEED_CONFIRMATION=development to run this seed."
    );
  }

  const target = assertNeonDatabaseTarget({
    environment: {
      DATABASE_URL_DIRECT: databaseUrl,
      DEVELOPMENT_DATABASE_HOST: expectedHost,
      DEVELOPMENT_NEON_BRANCH_ID: branchId,
      DEVELOPMENT_NEON_PROJECT_ID: projectId,
    },
    target: "development",
  });

  return { databaseName: target.databaseName, host: target.host };
};
