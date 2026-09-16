import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  completeLesson: vi.fn(),
  createSupportRequest: vi.fn(),
  enrollInFreeCourse: vi.fn(),
  logOperationalEvent: vi.fn(),
  recordLessonWatchProgress: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireRole: vi.fn(),
  requireSession: vi.fn(),
  scheduleOutboxDrainAfterResponse: vi.fn(),
  setCourseSaleInterest: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("@/db", () => ({ getPool: vi.fn() }));
vi.mock("@/features/courses/availability-server", () => ({
  setCourseSaleInterest: dependencies.setCourseSaleInterest,
}));
vi.mock("@/features/courses/preview", () => ({
  canMutateStudentExperience: () => true,
}));
vi.mock("@/features/courses/server", () => ({
  completeLesson: dependencies.completeLesson,
  recordLessonWatchProgress: dependencies.recordLessonWatchProgress,
}));
vi.mock("@/features/enrollments/free-enrollment", () => ({
  enrollInFreeCourse: dependencies.enrollInFreeCourse,
}));
vi.mock("@/features/learning-analytics/server", () => ({
  setLearningAnalyticsPreference: vi.fn(),
}));
vi.mock("@/features/support/server", () => ({
  createSupportRequest: dependencies.createSupportRequest,
}));
vi.mock("@/features/outbox/background-drain", () => ({
  scheduleOutboxDrainAfterResponse:
    dependencies.scheduleOutboxDrainAfterResponse,
}));
vi.mock("@/lib/session", () => ({
  requireRole: dependencies.requireRole,
  requireSession: dependencies.requireSession,
}));
vi.mock("@/lib/observability", () => ({
  createCorrelationId: () => "correlation-1",
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import {
  completeLessonAction,
  enrollFreeCourseAction,
  recordLessonWatchProgressAction,
  sendSupportRequestAction,
  setCourseSaleInterestAction,
} from "./actions";

describe("completeLessonAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
  });

  it("signals an issued certificate after the final lesson", async () => {
    dependencies.completeLesson.mockResolvedValue({
      certificateIssued: true,
      courseId: "course-1",
      nextLessonId: null,
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-final");

    await expect(completeLessonAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(dependencies.redirect).toHaveBeenCalledWith(
      "/app/cursos/course-1?certificate=issued"
    );
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).toHaveBeenCalledOnce();
  });

  it("keeps the course URL clean when no certificate was issued", async () => {
    dependencies.completeLesson.mockResolvedValue({
      certificateIssued: false,
      courseId: "course-1",
      nextLessonId: null,
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-final");

    await expect(completeLessonAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(dependencies.redirect).toHaveBeenCalledWith("/app/cursos/course-1");
  });

  it("keeps next-lesson navigation unchanged", async () => {
    dependencies.completeLesson.mockResolvedValue({
      certificateIssued: true,
      courseId: "course-1",
      nextLessonId: "lesson-next",
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-current");

    await expect(completeLessonAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(dependencies.redirect).toHaveBeenCalledWith(
      "/app/aulas/lesson-next"
    );
  });
});

describe("setCourseSaleInterestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    dependencies.setCourseSaleInterest.mockResolvedValue({ interested: true });
  });

  it("uses the authenticated Student identity and revalidates both surfaces", async () => {
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("interested", "true");

    await expect(setCourseSaleInterestAction(formData)).resolves.toEqual({
      interested: true,
    });

    expect(dependencies.setCourseSaleInterest).toHaveBeenCalledWith({
      courseId: "course-1",
      interested: true,
      userId: "student-1",
    });
    expect(dependencies.revalidatePath).toHaveBeenCalledWith("/app");
    expect(dependencies.revalidatePath).toHaveBeenCalledWith(
      "/comprar/[slug]",
      "page"
    );
  });

  it("rejects a team account before persisting interest", async () => {
    dependencies.requireSession.mockResolvedValue({
      role: "admin",
      user: { id: "admin-1" },
    });
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("interested", "true");

    await expect(setCourseSaleInterestAction(formData)).rejects.toThrow(
      "Apenas alunos podem demonstrar interesse."
    );
    expect(dependencies.setCourseSaleInterest).not.toHaveBeenCalled();
  });
});

describe("enrollFreeCourseAction", () => {
  const courseId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireRole.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    dependencies.enrollInFreeCourse.mockResolvedValue({ status: "created" });
  });

  it("uses only the authenticated Student and revalidates after the service succeeds", async () => {
    const formData = new FormData();
    formData.set("courseId", ` ${courseId} `);
    formData.set("userId", "attacker-1");

    await expect(enrollFreeCourseAction(formData)).resolves.toEqual({
      courseId,
      ok: true,
    });

    expect(dependencies.requireRole).toHaveBeenCalledWith(["student"]);
    expect(dependencies.enrollInFreeCourse).toHaveBeenCalledWith({
      courseId,
      userId: "student-1",
    });
    expect(dependencies.revalidatePath).toHaveBeenNthCalledWith(1, "/app");
    expect(dependencies.revalidatePath).toHaveBeenNthCalledWith(
      2,
      `/app/cursos/${courseId}`
    );
    expect(dependencies.revalidatePath).toHaveBeenNthCalledWith(
      3,
      "/comprar/[slug]",
      "page"
    );
  });

  it("rejects invalid input before calling the enrollment service", async () => {
    const formData = new FormData();
    formData.set("courseId", "course-1");

    await expect(enrollFreeCourseAction(formData)).resolves.toEqual({
      message: "Curso inválido.",
      ok: false,
    });

    expect(dependencies.enrollInFreeCourse).not.toHaveBeenCalled();
    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
    expect(dependencies.logOperationalEvent).not.toHaveBeenCalled();
  });

  it.each([
    "admin",
    "support",
  ] as const)("does not persist when the account role is %s", async () => {
    dependencies.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    const formData = new FormData();
    formData.set("courseId", courseId);

    await expect(enrollFreeCourseAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(dependencies.enrollInFreeCourse).not.toHaveBeenCalled();
  });

  it("does not persist when a blocked Student is rejected by the role guard", async () => {
    dependencies.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    const formData = new FormData();
    formData.set("courseId", courseId);

    await expect(enrollFreeCourseAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(dependencies.enrollInFreeCourse).not.toHaveBeenCalled();
  });

  it("returns a known domain error without logging it as an operational failure", async () => {
    dependencies.enrollInFreeCourse.mockRejectedValue(
      new Error("Preço diferente de zero.")
    );
    const formData = new FormData();
    formData.set("courseId", courseId);

    await expect(enrollFreeCourseAction(formData)).resolves.toEqual({
      message: "Preço diferente de zero.",
      ok: false,
    });

    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
    expect(dependencies.logOperationalEvent).not.toHaveBeenCalled();
  });

  it("hides and logs unexpected service failures without exposing database details", async () => {
    dependencies.enrollInFreeCourse.mockRejectedValue(
      new Error("database connection details")
    );
    const formData = new FormData();
    formData.set("courseId", courseId);

    await expect(enrollFreeCourseAction(formData)).resolves.toEqual({
      message:
        "Não foi possível concluir a inscrição gratuita. Tente novamente.",
      ok: false,
    });

    expect(dependencies.logOperationalEvent).toHaveBeenCalledWith({
      aggregateId: courseId,
      correlationId: "correlation-1",
      errorCode: "free_enrollment_action_failed",
      operation: "student.free_enrollment",
      outcome: "failure",
      provider: "database",
    });
    expect(dependencies.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("recordLessonWatchProgressAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
  });

  it("drains the outbox only when video completion emitted a certificate", async () => {
    dependencies.recordLessonWatchProgress.mockResolvedValue({
      certificateIssued: false,
      completed: true,
      courseId: "course-1",
      nextLessonId: null,
      watchedPercent: 100,
    });

    await expect(
      recordLessonWatchProgressAction({
        currentSeconds: 60,
        durationSeconds: 60,
        eventName: "jmvplayerout-end",
        lessonId: "lesson-1",
      })
    ).resolves.toMatchObject({ completed: true });

    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).not.toHaveBeenCalled();

    dependencies.recordLessonWatchProgress.mockResolvedValueOnce({
      certificateIssued: true,
      completed: true,
      courseId: "course-1",
      nextLessonId: null,
      watchedPercent: 100,
    });

    await recordLessonWatchProgressAction({
      currentSeconds: 60,
      durationSeconds: 60,
      eventName: "jmvplayerout-end",
      lessonId: "lesson-1",
    });
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).toHaveBeenCalledOnce();
  });
});

describe("sendSupportRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    dependencies.createSupportRequest.mockResolvedValue(undefined);
  });

  it("persists the request for the outbox instead of sending inline", async () => {
    const formData = new FormData();
    formData.set("subject", "Dúvida controlada");
    formData.set("message", "Mensagem de teste controlada.");
    formData.set("courseTitle", "Curso de suporte");

    await sendSupportRequestAction(formData);

    expect(dependencies.createSupportRequest).toHaveBeenCalledWith({
      courseTitle: "Curso de suporte",
      message: "Mensagem de teste controlada.",
      subject: "Dúvida controlada",
      userId: "student-1",
    });
    expect(
      dependencies.scheduleOutboxDrainAfterResponse
    ).toHaveBeenCalledOnce();
  });

  it("rejects the request without subject or message", async () => {
    const formData = new FormData();
    formData.set("subject", "");

    await expect(sendSupportRequestAction(formData)).rejects.toThrow(
      "Informe assunto e mensagem para o suporte."
    );
    expect(dependencies.createSupportRequest).not.toHaveBeenCalled();
  });
});
