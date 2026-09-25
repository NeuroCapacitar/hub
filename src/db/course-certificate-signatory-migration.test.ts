import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("course certificate signatory migration", () => {
  it("moves stored course-specific values without inheriting global defaults", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0090_course_certificate_signatory.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain('"certificate_signer_name"');
    expect(migration).toContain('"certificate_signer_role"');
    expect(migration).toContain('"certificate_templates"');
    expect(migration).toContain('template."signer_name"');
    expect(migration).toContain('template."signer_role"');
    expect(migration).not.toContain('"app_settings"');
    expect(migration).not.toContain(
      '"certificate_signer_name" from "app_settings"'
    );
  });
});
