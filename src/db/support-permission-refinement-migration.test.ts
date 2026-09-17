import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const REFINED_GRANTS = [
  "createCourse",
  "manageCourseDetails",
  "manageCourseContent",
  "manageCourseAvailability",
  "manageCourseCertificate",
  "manageEnrollmentSupport",
  "manageEnrollmentAccess",
  "reissueCertificates",
  "manageCertificateIssuerProfile",
  "executeRefund",
  "manageFinancialOperations",
  "manageFinancialReviews",
  "manageOperations",
] as const;

const REFINED_VIEWS = [
  "viewFinancialAnalysis",
  "viewFinancialOrders",
  "viewFinancialReviews",
  "viewAudit",
] as const;

describe("support permission refinement migration", () => {
  it("resets old Support grants before installing the refined constraints", async () => {
    const migration = await readFile(
      new URL("./migrations/0085_superb_wonder_man.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain(
      'UPDATE "profiles"\nSET\n  "support_permission_grants" = \'{}\'::text[],\n  "support_permission_views" = \'{}\'::text[]\nWHERE "role" = \'support\';'
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "profiles_support_permission_grants_consistent"'
    );
    expect(migration).toContain(
      'ADD CONSTRAINT "profiles_support_permission_views_consistent"'
    );

    for (const grant of REFINED_GRANTS) {
      expect(migration).toContain(`'${grant}'`);
    }
    for (const view of REFINED_VIEWS) {
      expect(migration).toContain(`'${view}'`);
    }

    expect(migration.indexOf('UPDATE "profiles"')).toBeLessThan(
      migration.indexOf(
        'ADD CONSTRAINT "profiles_support_permission_grants_consistent"'
      )
    );
    expect(migration).not.toContain("'viewAdminPanel'");
    expect(migration).not.toContain("'manageCourses'");
    expect(migration).not.toContain("'exportLearningAnalytics'");
  });
});
