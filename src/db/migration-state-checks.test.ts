import { describe, expect, it } from "vitest";
import {
  certificateMigrationStateChecks,
  courseContentMigrationStateChecks,
  supportPermissionMigrationStateChecks,
  supportPermissionRefinementMigrationStateChecks,
  supportPermissionViewsMigrationStateChecks,
} from "./migration-state-checks";

const MUTATING_STATEMENT_PATTERN =
  /\b(alter|create|delete|drop|insert|truncate|update)\b/i;

describe("migration state checks", () => {
  it("covers the Module and Publication ownership constraint", () => {
    const [ownershipCheck] = courseContentMigrationStateChecks;

    expect(courseContentMigrationStateChecks).toHaveLength(2);
    expect(ownershipCheck?.migration).toBe(
      "0078_protect_module_course_publication_ownership"
    );
    expect(ownershipCheck?.statement).toContain(
      "course_publications_id_course_unique"
    );
    expect(ownershipCheck?.statement).toContain(
      "modules_course_publication_course_fk"
    );
  });

  it("covers the Lesson, Module and Publication ownership constraint", () => {
    const ownershipCheck = courseContentMigrationStateChecks[1];

    expect(ownershipCheck?.migration).toBe(
      "0079_protect_lesson_module_publication_ownership"
    );
    expect(ownershipCheck?.statement).toContain(
      "modules_id_course_publication_unique"
    );
    expect(ownershipCheck?.statement).toContain(
      "lessons_module_course_publication_fk"
    );
  });

  it("covers the certificate template and render-claim catalog", () => {
    const certificateChecks = certificateMigrationStateChecks;

    expect(certificateChecks).toHaveLength(3);
    expect(certificateChecks[0]?.statement).toContain(
      "certificate_issuer_profiles"
    );
    expect(certificateChecks[0]?.statement).toContain("certificate_templates");
    expect(certificateChecks[0]?.statement).toContain("pdf_storage_key");
    expect(certificateChecks[0]?.statement).toContain("pdf_url");
    expect(certificateChecks[1]?.statement).toContain("render_claim_token");
    expect(certificateChecks[1]?.statement).toContain(
      "certificates_ready_artifact_check"
    );
    expect(certificateChecks[2]?.statement).toContain(
      "certificates_revocation_state_check"
    );
  });

  it("keeps every migration audit query read-only", () => {
    for (const check of [
      ...courseContentMigrationStateChecks,
      ...certificateMigrationStateChecks,
      ...supportPermissionMigrationStateChecks,
      ...supportPermissionViewsMigrationStateChecks,
      ...supportPermissionRefinementMigrationStateChecks,
    ]) {
      expect(check.statement).not.toMatch(MUTATING_STATEMENT_PATTERN);
    }
  });

  it("reports missing support grants schema as absent without referencing a missing column", () => {
    const [check] = supportPermissionMigrationStateChecks;

    expect(check?.migration).toBe("0083_support_permission_grants");
    expect(check?.statement).toContain("case when exists");
    expect(check?.statement).toContain("to_jsonb(profiles)");
    expect(check?.statement).toContain("else false end as present");
  });

  it("checks the refined allowlist and the intentional grant reset", () => {
    const [check] = supportPermissionRefinementMigrationStateChecks;

    expect(check?.migration).toBe("0085_superb_wonder_man");
    expect(check?.statement).toContain("createCourse");
    expect(check?.statement).toContain("viewFinancialAnalysis");
    expect(check?.statement).toContain(
      "cardinality(support_permission_grants)"
    );
  });
});
