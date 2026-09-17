import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const LEGACY_SUPPORT_GRANTS = [
  "executeRefund",
  "manageEnrollmentSupport",
  "reissueCertificates",
] as const;

const DELEGABLE_SUPPORT_GRANTS = [
  ...LEGACY_SUPPORT_GRANTS,
  "manageFinancialOperations",
  "manageFinancialReviews",
] as const;
const DESTRUCTIVE_MIGRATION_PATTERN = /\b(drop|truncate)\b/i;

describe("support permission grants migration", () => {
  it("adds the column, preserves legacy grants, and constrains the profile", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0083_support_permission_grants.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain(
      "ADD COLUMN \"support_permission_grants\" text[] DEFAULT '{}'::text[] NOT NULL"
    );
    expect(migration).toContain('SET "support_permission_grants" = ARRAY[');
    for (const permission of LEGACY_SUPPORT_GRANTS) {
      expect(migration).toContain(`'${permission}'`);
    }
    for (const permission of DELEGABLE_SUPPORT_GRANTS) {
      expect(migration).toContain(`'${permission}'`);
    }
    expect(migration).toContain(
      'ADD CONSTRAINT "profiles_support_permission_grants_consistent"'
    );
    expect(migration).toContain(
      'cardinality("profiles"."support_permission_grants") = ('
    );
    expect(migration).toContain(
      'array_position("profiles"."support_permission_grants", \'manageFinancialReviews\')'
    );
    expect(migration.indexOf('SET "support_permission_grants"')).toBeLessThan(
      migration.indexOf(
        'ADD CONSTRAINT "profiles_support_permission_grants_consistent"'
      )
    );
    expect(migration).not.toMatch(DESTRUCTIVE_MIGRATION_PATTERN);
  });

  it("keeps the schema column non-null with an empty default", async () => {
    const schema = await readFile(
      new URL("./schema.ts", import.meta.url),
      "utf8"
    );

    expect(schema).toContain(
      'supportPermissionGrants: text("support_permission_grants")'
    );
    expect(schema).toContain(".default(sql`'{}'::text[]`)");
    expect(schema).toContain('"profiles_support_permission_grants_consistent"');
  });
});
