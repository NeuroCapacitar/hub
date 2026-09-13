import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("course publication migration", () => {
  it("consolidates legacy valid certificates before enforcing one valid certificate per Course", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0035_course_publications_and_completions.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain("duplicate_or_technical_issue");
    expect(migration.indexOf("duplicate_or_technical_issue")).toBeLessThan(
      migration.indexOf("certificates_user_course_active_unique_idx")
    );
  });

  it("adds only the new curriculum identity and draft invariant after 0035", async () => {
    const migration = await readFile(
      new URL("./migrations/0036_ambitious_shinobi_shaw.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain('ADD COLUMN "curriculum_key"');
    expect(migration).toContain('"lessons_curriculum_key_idx"');
    expect(migration).toContain(
      '"course_publications_one_draft_per_course_idx"'
    );
    expect(migration).not.toContain("DROP TABLE");
    expect(migration).not.toContain("course_versions");
  });

  it("protects Module ownership before adding the composite foreign key", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0078_protect_module_course_publication_ownership.sql",
        import.meta.url
      ),
      "utf8"
    );
    const uniqueConstraint =
      'ALTER TABLE "course_publications" ADD CONSTRAINT "course_publications_id_course_unique"';
    const ownershipForeignKey =
      'ALTER TABLE "modules" ADD CONSTRAINT "modules_course_publication_course_fk"';

    expect(migration).toContain(uniqueConstraint);
    expect(migration).toContain(ownershipForeignKey);
    expect(migration.indexOf(uniqueConstraint)).toBeLessThan(
      migration.indexOf(ownershipForeignKey)
    );
    expect(migration).toContain(
      'FOREIGN KEY ("course_publication_id","course_id") REFERENCES "public"."course_publications"("id","course_id")'
    );
  });

  it("protects Lesson ownership before adding the composite foreign key", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0079_protect_lesson_module_publication_ownership.sql",
        import.meta.url
      ),
      "utf8"
    );
    const uniqueConstraint =
      'ALTER TABLE "modules" ADD CONSTRAINT "modules_id_course_publication_unique"';
    const ownershipForeignKey =
      'ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_course_publication_fk"';

    expect(migration).toContain(uniqueConstraint);
    expect(migration).toContain(ownershipForeignKey);
    expect(migration.indexOf(uniqueConstraint)).toBeLessThan(
      migration.indexOf(ownershipForeignKey)
    );
    expect(migration).toContain(
      'FOREIGN KEY ("module_id","course_publication_id") REFERENCES "public"."modules"("id","course_publication_id")'
    );
  });
});
