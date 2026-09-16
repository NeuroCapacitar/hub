import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("free enrollment migrations", () => {
  it("adds enum values before using them in the contract migration", async () => {
    const [enumMigration, contractMigration] = await Promise.all([
      readFile(
        new URL("./migrations/0081_free_enrollment_enums.sql", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL(
          "./migrations/0082_free_enrollment_contract.sql",
          import.meta.url
        ),
        "utf8"
      ),
    ]);

    expect(enumMigration).toContain(
      'ALTER TYPE "public"."enrollment_event_type" ADD VALUE \'free_enrollment_granted\''
    );
    expect(enumMigration).toContain(
      'ALTER TYPE "public"."enrollment_grant_source_type" ADD VALUE \'free_enrollment\''
    );
    expect(enumMigration).not.toContain("enrollment_grants_source_shape_check");
    expect(enumMigration).not.toContain(
      "enrollment_grants_free_user_course_unique_idx"
    );

    expect(contractMigration).toContain(
      "enrollment_grants_free_user_course_unique_idx"
    );
    expect(contractMigration).toContain("source_type\" = 'free_enrollment'");
    expect(contractMigration).toContain('manual_reference" is null');
    expect(contractMigration).toContain('order_id" is null');
  });
});
