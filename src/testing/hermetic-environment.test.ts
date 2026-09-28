import { describe, expect, it } from "vitest";
import { createHermeticTestEnvironment } from "./hermetic-environment";

describe("hermetic test environment", () => {
  it("removes application configuration while preserving process tooling", () => {
    expect(
      createHermeticTestEnvironment({
        DATABASE_URL: "postgresql://ambient.example/hub",
        GOOGLE_CLIENT_ID: "ambient-google-client-id",
        GOOGLE_CLIENT_SECRET: "ambient-google-client-secret",
        NODE_ENV: "test",
        PATH: "C:\\tools",
        RESEND_API_KEY: "ambient-resend-key",
        USERNAME: "test-runner",
      })
    ).toEqual({
      NODE_ENV: "test",
      PATH: "C:\\tools",
      USERNAME: "test-runner",
    });
  });
});
