import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const SUPPORT_VIEW_PERMISSIONS = [
  "viewAdminPanel",
  "viewLearningAnalytics",
  "viewCourses",
  "viewStudents",
  "viewFinancials",
  "viewOperations",
  "viewAudit",
  "viewSettings",
] as const;
const DESTRUCTIVE_MIGRATION_PATTERN =
  /\b(drop|truncate)\b(?![^\n]*constraint)/i;

describe("support permission views migration", () => {
  it("backfills existing Support views and preserves the role invariant", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0084_support_permission_views.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain(
      "ADD COLUMN \"support_permission_views\" text[] DEFAULT '{}'::text[] NOT NULL"
    );
    expect(migration).toContain(
      'DROP CONSTRAINT "profiles_support_permission_grants_consistent"'
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "profiles_support_permission_views_consistent"'
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "profiles_support_permission_grants_consistent"'
    );
    for (const permission of SUPPORT_VIEW_PERMISSIONS) {
      expect(migration).toContain(`'${permission}'`);
    }
    expect(migration).toContain("'exportLearningAnalytics'");
    expect(migration).toContain("'manageCourses'");
    expect(migration.indexOf('SET "support_permission_views"')).toBeLessThan(
      migration.indexOf(
        'ADD CONSTRAINT "profiles_support_permission_views_consistent"'
      )
    );
    expect(migration).not.toMatch(DESTRUCTIVE_MIGRATION_PATTERN);
  });

  it("keeps the schema view column non-null with an empty default", async () => {
    const schema = await readFile(
      new URL("./schema.ts", import.meta.url),
      "utf8"
    );

    expect(schema).toContain(
      'supportPermissionViews: text("support_permission_views")'
    );
    expect(schema).toContain('"profiles_support_permission_views_consistent"');
  });
});
