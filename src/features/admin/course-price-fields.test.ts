import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin course price fields", () => {
  it("gives simultaneous course creation forms distinct price field ids", async () => {
    const pageSource = await readFile(
      new URL("../../app/(admin)/admin/cursos/page.tsx", import.meta.url),
      "utf8"
    );
    const formSource = await readFile(
      new URL(
        "../../app/(admin)/admin/cursos/course-creation-form.tsx",
        import.meta.url
      ),
      "utf8"
    );
    const priceFieldIds = ["new-course-price", "empty-course-price"] as const;

    for (const priceFieldId of priceFieldIds) {
      expect(pageSource).toContain(`priceFieldId="${priceFieldId}"`);
    }
    expect(new Set(priceFieldIds).size).toBe(priceFieldIds.length);
    expect(formSource).toContain("htmlFor={priceFieldId}");
    expect(formSource).toContain("id={priceFieldId}");
  });

  it("associates the settings price label and input", async () => {
    const source = await readFile(
      new URL(
        "../../app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx",
        import.meta.url
      ),
      "utf8"
    );
    const fieldId = "course-settings-price";

    expect(source).toContain(`<FieldLabel htmlFor="${fieldId}">`);
    expect(source).toContain(`id="${fieldId}"`);
  });
});
