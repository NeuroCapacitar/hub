import { LessonAuthoringError } from "@/features/admin/lesson-authoring-errors";
import {
  readAuthoringPositiveInteger,
  readAuthoringString,
} from "./authoring-input";

export interface LessonDraftInput {
  description: string | null;
  moduleId: string;
  sortOrder: number;
  title: string;
}

const readString = readAuthoringString;

export const normalizeLessonDraftInput = (
  formData: FormData
): LessonDraftInput => {
  const moduleId = readString(formData, "moduleId");
  const title = readString(formData, "title");
  const description = readString(formData, "description") || null;

  if (!moduleId) {
    throw new LessonAuthoringError("Informe o módulo da aula.");
  }

  if (!title) {
    throw new LessonAuthoringError("Informe o título da aula.", "title");
  }

  return {
    description,
    moduleId,
    sortOrder: readAuthoringPositiveInteger(formData, "sortOrder", 1),
    title,
  };
};

export const buildAdminLessonEditPath = ({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}): string => `/admin/cursos/${courseId}/aulas/${lessonId}`;

export const buildAdminCourseEditPath = (courseId: string): string =>
  `/admin/cursos/${courseId}`;
