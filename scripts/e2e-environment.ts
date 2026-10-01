import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const LOCAL_E2E_ENV_PATH = ".env.e2e.local";

export const applyE2eDatabaseEnvironment = (
  environment: NodeJS.ProcessEnv
): void => {
  const e2eDatabaseUrl = environment.E2E_DATABASE_URL?.trim();
  if (!e2eDatabaseUrl) {
    return;
  }

  environment.E2E_DATABASE_URL = e2eDatabaseUrl;
  environment.DATABASE_URL = e2eDatabaseUrl;
  environment.DATABASE_URL_DIRECT = e2eDatabaseUrl;
};

export const loadE2eEnvironment = (): void => {
  const localE2eEnvPath = resolve(process.cwd(), LOCAL_E2E_ENV_PATH);
  if (existsSync(localE2eEnvPath)) {
    const result = config({
      override: true,
      path: localE2eEnvPath,
      quiet: true,
    });
    if (result.error) {
      throw result.error;
    }
  }

  applyE2eDatabaseEnvironment(process.env);
};
