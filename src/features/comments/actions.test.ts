import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("lesson comments actions", () => {
  it("authenticates comment creation and revalidates lesson pages", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain('"use server"');
    expect(source).toContain("requireSession()");
    expect(source).toContain("canMutateStudentExperience(session.role)");
    expect(source).toContain('context !== "admin" && context !== "student"');
    expect(source).toContain("createLessonComment");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: matching literal source text
    expect(source).toContain("revalidatePath(`/app/aulas/${lessonId}`)");
    expect(source).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: matching literal source text
      "revalidatePath(`/admin/cursos/${result.courseId}/aulas/${lessonId}`)"
    );
  });

  it("allows Admin and Support to manage comments without a new permission", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("isLessonCommentManager");
    expect(source).not.toContain('requirePermission("manageContent")');
    expect(source).toContain("hideLessonComment");
    expect(source).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: matching literal source text
      "revalidatePath(`/admin/cursos/${result.courseId}/aulas/${result.lessonId}`)"
    );
  });

  it("audits and revalidates comment restoration for staff roles", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("restoreLessonCommentAction");
    expect(source).toContain("isLessonCommentManager");
    expect(source).not.toContain('requirePermission("manageContent")');
    expect(source).toContain("restoreLessonComment");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: matching literal source text
    expect(source).toContain("revalidatePath(`/app/aulas/${result.lessonId}`)");
    expect(source).toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: matching literal source text
      "revalidatePath(`/admin/cursos/${result.courseId}/aulas/${result.lessonId}`)"
    );
  });
});
