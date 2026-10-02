import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRole } from "@/lib/session";

const dependencies = vi.hoisted(() => ({
  createLessonComment: vi.fn(),
  hideLessonComment: vi.fn(),
  restoreLessonComment: vi.fn(),
  requireSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: dependencies.revalidatePath,
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("permission denied");
  },
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));
vi.mock("@/features/comments/server", () => ({
  createLessonComment: dependencies.createLessonComment,
  hideLessonComment: dependencies.hideLessonComment,
  restoreLessonComment: dependencies.restoreLessonComment,
}));

import {
  createLessonCommentAction,
  hideLessonCommentAction,
  restoreLessonCommentAction,
} from "./actions";

const setRole = (role: AppRole): void => {
  dependencies.requireSession.mockResolvedValue({
    role,
    supportPermissionGrants: [],
    supportPermissionViews: [],
    user: { id: `${role}-1` },
  });
};

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
});

describe("comment moderation authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.hideLessonComment.mockResolvedValue({
      lessonId: "lesson-1",
      courseId: "course-1",
    });
    dependencies.restoreLessonComment.mockResolvedValue({
      lessonId: "lesson-1",
      courseId: "course-1",
    });
  });

  it.each([
    "support",
    "student",
  ] as const)("rejects hide and restore by %s before any mutation", async (role) => {
    setRole(role);
    const formData = new FormData();
    formData.set("commentId", "comment-1");

    await expect(hideLessonCommentAction(formData)).rejects.toThrow(
      "permission denied"
    );
    await expect(restoreLessonCommentAction(formData)).rejects.toThrow(
      "permission denied"
    );

    expect(dependencies.hideLessonComment).not.toHaveBeenCalled();
    expect(dependencies.restoreLessonComment).not.toHaveBeenCalled();
    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
  });

  it("allows Admin to hide and restore with the authenticated actor", async () => {
    setRole("admin");
    const formData = new FormData();
    formData.set("commentId", "comment-1");

    await hideLessonCommentAction(formData);
    await restoreLessonCommentAction(formData);

    const input = { actorUserId: "admin-1", commentId: "comment-1" };
    expect(dependencies.hideLessonComment).toHaveBeenCalledWith(input);
    expect(dependencies.restoreLessonComment).toHaveBeenCalledWith(input);
    expect(dependencies.revalidatePath).toHaveBeenCalledWith(
      "/app/aulas/lesson-1"
    );
  });

  it("preserves Support replies in the administrative context", async () => {
    setRole("support");
    dependencies.createLessonComment.mockResolvedValue({
      courseId: "course-1",
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-1");
    formData.set("context", "admin");
    formData.set("parentId", "comment-1");
    formData.set("body", "Resposta de suporte");

    await createLessonCommentAction(formData);

    expect(dependencies.createLessonComment).toHaveBeenCalledWith({
      lessonId: "lesson-1",
      parentId: "comment-1",
      body: "Resposta de suporte",
      role: "support",
      userId: "support-1",
    });
  });
});
