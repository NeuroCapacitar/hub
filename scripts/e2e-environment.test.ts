import { describe, expect, it } from "vitest";
import { applyE2eDatabaseEnvironment } from "./e2e-environment";

describe("E2E database environment", () => {
  it("forces server and migration URLs to the dedicated direct E2E database", () => {
    const environment: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://developer@localhost/hub_development",
      DATABASE_URL_DIRECT: "postgresql://developer@localhost/hub_development",
      E2E_DATABASE_URL: "postgresql://e2e@e2e.example.test/hub_e2e",
      E2E_RUNTIME_DATABASE_URL:
        "postgresql://e2e@e2e-pooler.example.test/hub_e2e",
      NODE_ENV: "test",
    };

    applyE2eDatabaseEnvironment(environment);

    expect(environment.DATABASE_URL).toBe(environment.E2E_DATABASE_URL);
    expect(environment.DATABASE_URL_DIRECT).toBe(environment.E2E_DATABASE_URL);
    expect(environment.E2E_RUNTIME_DATABASE_URL).toBe(
      "postgresql://e2e@e2e-pooler.example.test/hub_e2e"
    );
  });

  it("does not replace local database settings when no E2E URL is configured", () => {
    const environment: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://developer@localhost/hub_development",
      DATABASE_URL_DIRECT: "postgresql://developer@localhost/hub_development",
      NODE_ENV: "test",
    };

    applyE2eDatabaseEnvironment(environment);

    expect(environment.DATABASE_URL).toBe(
      "postgresql://developer@localhost/hub_development"
    );
    expect(environment.DATABASE_URL_DIRECT).toBe(
      "postgresql://developer@localhost/hub_development"
    );
  });
});
