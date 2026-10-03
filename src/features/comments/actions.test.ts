import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AuthPermission, canPerform } from "@/lib/auth-policy";
import type { AppRole } from "@/lib/session";

const dependencies = vi.hoisted(() => ({
  createLessonComment: vi.fn(),
  hideLessonComment: vi.fn(),
  restoreLessonComment: vi.fn(),
  requirePermission: vi.fn(),
  requireSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
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

const configureSession = (role: AppRole): void => {
  const session = {
    role,
    supportPermissionGrants: [],
    supportPermissionViews: [],
    user: { id: `${role}-1` },
  };
  dependencies.requireSession.mockResolvedValue(session);
  dependencies.requirePermission.mockImplementation(
    (permission: AuthPermission) => {
      if (!canPerform(session, permission)) {
        throw new Error("permission_denied");
      }
      return Promise.resolve(session);
    }
  );
};

const commentForm = (): FormData => {
  const form = new FormData();
  form.set("commentId", "comment-1");
  return form;
};

describe("lesson comment authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.hideLessonComment.mockResolvedValue({
      courseId: "course-1",
      lessonId: "lesson-1",
    });
    dependencies.restoreLessonComment.mockResolvedValue({
      courseId: "course-1",
      lessonId: "lesson-1",
    });
    dependencies.createLessonComment.mockResolvedValue({
      courseId: "course-1",
    });
  });

  it.each([
    "support",
    "student",
  ] as const)("refuses moderation by %s before mutation", async (role) => {
    configureSession(role);
    await expect(hideLessonCommentAction(commentForm())).rejects.toThrow(
      "permission_denied"
    );
    await expect(restoreLessonCommentAction(commentForm())).rejects.toThrow(
      "permission_denied"
    );
    expect(dependencies.requirePermission).toHaveBeenCalledWith(
      "manageContent"
    );
    expect(dependencies.hideLessonComment).not.toHaveBeenCalled();
    expect(dependencies.restoreLessonComment).not.toHaveBeenCalled();
    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
  });

  it("permits Admin to hide and restore using the authenticated actor", async () => {
    configureSession("admin");
    await hideLessonCommentAction(commentForm());
    await restoreLessonCommentAction(commentForm());
    expect(dependencies.hideLessonComment).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      commentId: "comment-1",
    });
    expect(dependencies.restoreLessonComment).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      commentId: "comment-1",
    });
    expect(dependencies.revalidatePath).toHaveBeenCalledWith(
      "/app/aulas/lesson-1"
    );
  });

  it("keeps Support replies available without moderation authority", async () => {
    configureSession("support");
    const form = new FormData();
    form.set("lessonId", "lesson-1");
    form.set("parentId", "parent-1");
    form.set("context", "admin");
    form.set("body", "Resposta do Suporte");
    await createLessonCommentAction(form);
    expect(dependencies.createLessonComment).toHaveBeenCalledWith({
      body: "Resposta do Suporte",
      lessonId: "lesson-1",
      parentId: "parent-1",
      role: "support",
      userId: "support-1",
    });
    expect(dependencies.requirePermission).not.toHaveBeenCalled();
  });
});
