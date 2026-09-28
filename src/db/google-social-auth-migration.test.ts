import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const MUTATION_SQL_PATTERN = /\b(delete|update)\b/i;

describe("Google social authentication migrations", () => {
  it("adds the local email-verification lifecycle identifiers", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0095_google_account_identity_and_verification_email.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain("'auth.email-verification'");
    expect(migration).toContain("'auth-email-verification'");
    expect(migration).not.toMatch(MUTATION_SQL_PATTERN);
  });

  it("uniquely protects the provider/account identity pair", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0096_google_provider_account_identity_unique_index.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain(
      'CREATE UNIQUE INDEX "accounts_provider_account_unique_idx"'
    );
    expect(migration).toContain('"provider_id","account_id"');
    expect(migration).not.toMatch(MUTATION_SQL_PATTERN);
  });
});
