"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/db";
import { setCourseSaleInterest } from "@/features/courses/availability-server";
import { canMutateStudentExperience } from "@/features/courses/preview";
import {
  completeLesson,
  recordLessonWatchProgress,
} from "@/features/courses/server";
import { enrollInFreeCourse } from "@/features/enrollments/free-enrollment";
import { setLearningAnalyticsPreference } from "@/features/learning-analytics/server";
import { scheduleOutboxDrainAfterResponse } from "@/features/outbox/background-drain";
import { createSupportRequest } from "@/features/support/server";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability";
import { route } from "@/lib/routes";
import { requireRole, requireSession } from "@/lib/session";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FREE_ENROLLMENT_DOMAIN_MESSAGES = new Set([
  "Curso inválido.",
  "Curso inexistente, arquivado, draft ou inativo.",
  "Estado de vendas fechado.",
  "Publicação de Curso ausente.",
  "Preço diferente de zero.",
  "Duração de acesso inválida.",
  "Cronograma incompatível.",
  "Matrícula revogada não pode receber novo acesso.",
  "Concessão gratuita encerrada não pode ser reativada.",
  "Concessão gratuita existente não pode ser substituída.",
]);

const getFreeEnrollmentDomainMessage = (error: unknown): string | null => {
  if (!(error instanceof Error)) {
    return null;
  }

  return FREE_ENROLLMENT_DOMAIN_MESSAGES.has(error.message)
    ? error.message
    : null;
};

export type FreeEnrollmentActionResult =
  | { courseId: string; ok: true }
  | { message: string; ok: false };

export const enrollFreeCourseAction = async (
  formData: FormData
): Promise<FreeEnrollmentActionResult> => {
  const session = await requireRole(["student"]);
  const courseId = readString(formData, "courseId");

  if (!UUID_PATTERN.test(courseId)) {
    return { message: "Curso inválido.", ok: false };
  }

  try {
    await enrollInFreeCourse({ courseId, userId: session.user.id });
    revalidatePath("/app");
    revalidatePath(`/app/cursos/${courseId}`);
    revalidatePath("/comprar/[slug]", "page");
    return { courseId, ok: true };
  } catch (error) {
    const message = getFreeEnrollmentDomainMessage(error);
    if (message) {
      return { message, ok: false };
    }

    logOperationalEvent({
      aggregateId: courseId,
      correlationId: createCorrelationId(null),
      errorCode: "free_enrollment_action_failed",
      operation: "student.free_enrollment",
      outcome: "failure",
      provider: "database",
    });
    return {
      message:
        "Não foi possível concluir a inscrição gratuita. Tente novamente.",
      ok: false,
    };
  }
};

export const completeLessonAction = async (formData: FormData) => {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    throw new Error("O preview do aluno não permite gravar progresso.");
  }

  const lessonId = String(formData.get("lessonId") ?? "");

  if (!lessonId) {
    throw new Error("Aula inválida.");
  }

  const result = await completeLesson({
    userId: session.user.id,
    lessonId,
  });

  if (result.certificateIssued) {
    scheduleOutboxDrainAfterResponse();
  }

  if (result.nextLessonId) {
    redirect(route(`/app/aulas/${result.nextLessonId}`));
  }

  redirect(
    route(
      `/app/cursos/${result.courseId}${
        result.certificateIssued ? "?certificate=issued" : ""
      }`
    )
  );
};

export const recordLessonWatchProgressAction = async ({
  currentSeconds,
  durationSeconds,
  eventName,
  eventSequence,
  isPaused,
  lessonId,
  trackingSessionId,
}: {
  currentSeconds: number;
  durationSeconds: number;
  eventName: string;
  eventSequence?: number;
  isPaused?: boolean;
  lessonId: string;
  trackingSessionId?: string;
}): Promise<{
  completed: boolean;
  courseId: string;
  nextLessonId: string | null;
  watchedPercent: number;
}> => {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    throw new Error("O preview do aluno não permite gravar progresso.");
  }

  if (!lessonId) {
    throw new Error("Aula inválida.");
  }

  const result = await recordLessonWatchProgress({
    currentSeconds,
    durationSeconds,
    eventName,
    ...(eventSequence === undefined ? {} : { eventSequence }),
    ...(isPaused === undefined ? {} : { isPaused }),
    lessonId,
    ...(trackingSessionId === undefined ? {} : { trackingSessionId }),
    userId: session.user.id,
  });

  if (result.certificateIssued) {
    scheduleOutboxDrainAfterResponse();
  }

  return result;
};

export const sendSupportRequestAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    throw new Error("O preview do aluno não permite enviar suporte.");
  }

  const subject = readString(formData, "subject");
  const message = readString(formData, "message");
  const courseTitle = readString(formData, "courseTitle") || undefined;

  if (!(subject && message)) {
    throw new Error("Informe assunto e mensagem para o suporte.");
  }

  await createSupportRequest({
    ...(courseTitle ? { courseTitle } : {}),
    message,
    subject,
    userId: session.user.id,
  });
  scheduleOutboxDrainAfterResponse();
};

export const setLearningAnalyticsPreferenceAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();
  if (!canMutateStudentExperience(session.role)) {
    throw new Error(
      "O preview do aluno não permite alterar análises opcionais."
    );
  }
  await setLearningAnalyticsPreference({
    enabled: formData.get("enabled") === "true",
    userId: session.user.id,
  });
};

export const setCourseSaleInterestAction = async (
  formData: FormData
): Promise<{ interested: boolean }> => {
  const session = await requireSession();
  if (session.role !== "student") {
    throw new Error("Apenas alunos podem demonstrar interesse.");
  }
  const courseId = readString(formData, "courseId");
  if (!courseId) {
    throw new Error("Curso inválido.");
  }
  const result = await setCourseSaleInterest({
    courseId,
    interested: readString(formData, "interested") === "true",
    userId: session.user.id,
  });
  revalidatePath("/app");
  revalidatePath("/comprar/[slug]", "page");
  return result;
};

export const updateCertificateNameAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireSession();
  const name = readString(formData, "name");
  if (name.length < 2 || name.length > 120) {
    throw new Error("Informe um nome entre 2 e 120 caracteres.");
  }
  await getPool().query(
    "update users set name = $2, updated_at = now() where id = $1",
    [session.user.id, name]
  );
  revalidatePath("/app/configuracoes");
  revalidatePath("/app/cursos", "layout");
};
