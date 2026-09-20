"use server";

import { revalidatePath } from "next/cache";
import {
  createLessonComment,
  hideLessonComment,
  restoreLessonComment,
} from "@/features/comments/server";
import { canMutateStudentExperience } from "@/features/courses/preview";
import { requireSession } from "@/lib/session";
import { isLessonCommentManager } from "./rules";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

export const createLessonCommentAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();
  const lessonId = readString(formData, "lessonId");
  const parentId = readString(formData, "parentId") || null;
  const body = readString(formData, "body");
  const context = readString(formData, "context") || "student";

  if (!lessonId) {
    throw new Error("Aula invalida.");
  }

  if (context !== "admin" && context !== "student") {
    throw new Error("Contexto de comentário inválido.");
  }

  if (context === "student" && !canMutateStudentExperience(session.role)) {
    throw new Error("Preview de aluno nao permite comentar.");
  }

  if (context === "admin" && !isLessonCommentManager(session.role)) {
    throw new Error("Apenas Admin e Suporte podem gerenciar comentários.");
  }

  const result = await createLessonComment({
    body,
    lessonId,
    parentId,
    role: session.role,
    userId: session.user.id,
  });

  revalidatePath(`/app/aulas/${lessonId}`);
  revalidatePath(`/admin/cursos/${result.courseId}/aulas/${lessonId}`);
};

export const hideLessonCommentAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();
  if (!isLessonCommentManager(session.role)) {
    throw new Error("Apenas Admin e Suporte podem gerenciar comentários.");
  }
  const commentId = readString(formData, "commentId");

  if (!commentId) {
    throw new Error("Comentario invalido.");
  }

  const result = await hideLessonComment({
    actorUserId: session.user.id,
    commentId,
  });

  if (result.lessonId) {
    revalidatePath(`/app/aulas/${result.lessonId}`);
    revalidatePath(`/admin/cursos/${result.courseId}/aulas/${result.lessonId}`);
  } else {
    revalidatePath("/admin");
  }
};

export const restoreLessonCommentAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();
  if (!isLessonCommentManager(session.role)) {
    throw new Error("Apenas Admin e Suporte podem gerenciar comentários.");
  }
  const commentId = readString(formData, "commentId");

  if (!commentId) {
    throw new Error("Comentario invalido.");
  }

  const result = await restoreLessonComment({
    actorUserId: session.user.id,
    commentId,
  });

  if (result.lessonId) {
    revalidatePath(`/app/aulas/${result.lessonId}`);
    revalidatePath(`/admin/cursos/${result.courseId}/aulas/${result.lessonId}`);
  } else {
    revalidatePath("/admin");
  }
};
