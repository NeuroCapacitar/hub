import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getActiveBannersData: vi.fn(),
  getStudentCourseCatalog: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/banners/server", () => ({
  getActiveBannersData: dependencies.getActiveBannersData,
}));
vi.mock("@/features/courses/preview", () => ({
  canMutateStudentExperience: () => true,
}));
vi.mock("@/features/courses/server", () => ({
  getStudentCourseCatalog: dependencies.getStudentCourseCatalog,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));
vi.mock("@/features/courses/course-cover-image", () => ({
  CourseCoverImage: () => <div data-cover />,
}));
vi.mock("./student-banners-carousel", () => ({
  StudentBannersCarousel: () => <div data-banners />,
}));

import StudentDashboardPage from "./page";

const course = {
  accessDurationMonths: 12,
  accessStatus: "none",
  availabilityPreset: "coming_soon",
  certificateEnabled: false,
  completedCount: 0,
  courseId: "course-1",
  coverBlurDataUrl: null,
  description: "Descrição",
  expiresAt: null,
  isEnrolled: false,
  isInterested: false,
  launchDate: "2026-10-01",
  launchLandingUrl: null,
  lessonCount: 0,
  moduleCount: 0,
  nextLessonId: null,
  priceInCents: 10_000,
  paymentAllowCreditCard: true,
  paymentAllowPix: true,
  paymentMaxInstallmentCount: 3,
  progressPercent: 0,
  revokedReason: null,
  slug: "curso-futuro",
  thumbnailUrl: null,
  title: "Curso futuro",
  totalCount: 0,
  totalDurationSeconds: 0,
  workloadHours: 0,
} as const;

const getCardMarkup = (markup: string, title: string): string =>
  markup
    .split("<article ")
    .find((cardMarkup) => cardMarkup.includes(title))
    ?.split("</article>")[0] ?? "";

describe("Student dashboard availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
    dependencies.getActiveBannersData.mockResolvedValue({ banners: [] });
  });

  it("highlights the next lesson when one active course is available", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "active",
        availabilityPreset: "available",
        completedCount: 2,
        courseId: "course-active",
        expiresAt: new Date("2026-12-31T23:59:59.000Z"),
        isEnrolled: true,
        nextLessonDurationSeconds: 720,
        nextLessonId: "lesson-next",
        nextLessonTitle: "Comunicação em situações difíceis",
        nextModuleTitle: "Fundamentos da comunicação",
        progressPercent: 40,
        slug: "curso-ativo",
        title: "Curso ativo de fundamentos",
        totalCount: 5,
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());

    expect(markup).toContain("Continue aprendendo");
    expect(markup).toContain("Próximo passo");
    expect(markup).toContain("Comunicação em situações difíceis");
    expect(markup).toContain("12min");
    expect(markup).toContain('href="/app/aulas/lesson-next"');
    expect(markup).toContain("Continuar aula");
    expect(markup).toContain("Ver trilha");
    expect(markup).not.toContain("Retome sua jornada no ponto em que parou.");
  });

  it("does not choose a single course when multiple courses are active", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "active",
        availabilityPreset: "available",
        courseId: "course-active-1",
        expiresAt: new Date("2026-12-31T23:59:59.000Z"),
        isEnrolled: true,
        nextLessonDurationSeconds: 600,
        nextLessonId: "lesson-next-1",
        nextLessonTitle: "Aula um",
        nextModuleTitle: "Módulo um",
        progressPercent: 20,
        slug: "curso-ativo-1",
        title: "Curso ativo um",
      },
      {
        ...course,
        accessStatus: "active",
        availabilityPreset: "available",
        courseId: "course-active-2",
        expiresAt: new Date("2026-12-31T23:59:59.000Z"),
        isEnrolled: true,
        nextLessonDurationSeconds: 900,
        nextLessonId: "lesson-next-2",
        nextLessonTitle: "Aula dois",
        nextModuleTitle: "Módulo dois",
        progressPercent: 40,
        slug: "curso-ativo-2",
        title: "Curso ativo dois",
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());

    expect(markup).toContain("Retome sua jornada no ponto em que parou.");
    expect(markup).not.toContain("Próximo passo");
    expect(markup).toContain("Curso ativo um");
    expect(markup).toContain("Curso ativo dois");
  });

  it("explains when the next lesson is waiting for scheduled release", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "active",
        availabilityPreset: "available",
        courseId: "course-scheduled",
        expiresAt: new Date("2026-12-31T23:59:59.000Z"),
        isEnrolled: true,
        nextLessonDurationSeconds: null,
        nextLessonId: null,
        nextLessonTitle: null,
        nextModuleTitle: null,
        nextReleaseAt: new Date("2026-10-02T15:00:00.000Z"),
        progressPercent: 40,
        slug: "curso-programado",
        title: "Curso programado",
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());

    expect(markup).toContain("A próxima aula estará disponível em");
    expect(markup).toContain('href="/app/cursos/course-scheduled"');
    expect(markup).toContain("Ver trilha");
    expect(markup).not.toContain("Continuar aula");
  });

  it("uses a modal for free course acquisition", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        availabilityPreset: "available",
        courseId: "course-free",
        description: "Curso aberto para começar agora.",
        lessonCount: 3,
        priceInCents: 0,
        slug: "curso-gratuito",
        title: "Curso gratuito",
        workloadHours: 2,
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());

    expect(markup).toContain("Inscrever-se grátis");
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).not.toContain(">Adquirir acesso<");
  });

  it("opens the purchase summary from the purchasable card surface", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        availabilityPreset: "available",
        courseId: "course-paid",
        priceInCents: 15_000,
        slug: "curso-pago",
        title: "Curso pago",
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());
    const cardMarkup = getCardMarkup(markup, "Curso pago");

    expect(cardMarkup).toContain(
      'aria-label="Abrir resumo do Curso Curso pago"'
    );
    expect(cardMarkup).not.toContain('href="/comprar/curso-pago"');
  });

  it("combines upcoming courses with paused enrollments", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      course,
      {
        ...course,
        availabilityPreset: "sales_paused",
        courseId: "course-2",
        isInterested: true,
        launchDate: null,
        slug: "curso-pausado",
        title: "Curso pausado",
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());

    expect(markup).not.toContain("Seu espaço de aprendizagem");
    expect(markup).not.toContain(
      "Continue seus cursos, descubra novas possibilidades e acompanhe o que está chegando."
    );
    expect(markup).toContain(
      "Acompanhe cursos novos e inscrições que podem reabrir. A etiqueta indica o estado de cada curso."
    );
    expect(markup).toContain("Novo curso");
    expect(markup).toContain("Inscrições pausadas");
    expect(markup).toContain("Quero ser avisada");
    expect(markup).toContain("Cancelar aviso");
    expect(markup).not.toContain("Ver detalhes");
    expect(markup).not.toContain(
      "Peça um aviso para saber quando as inscrições reabrirem."
    );
    expect(markup).not.toContain("Adquirir acesso");
  });

  it("places expired access in the available catalog with a renewal action", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "expired",
        availabilityPreset: "available",
        courseId: "course-expired",
        slug: "curso-expirado",
        title: "Curso expirado",
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());
    const cardMarkup = getCardMarkup(markup, "Curso expirado");

    expect(markup).toContain("Disponíveis agora");
    expect(markup).not.toContain("Acesso requer suporte");
    expect(cardMarkup).toContain("Acesso expirado");
    expect(cardMarkup).toContain("Renovar acesso");
  });

  it("keeps revoked access in a support-only section", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "revoked",
        availabilityPreset: "sales_paused",
        courseId: "course-revoked",
        slug: "curso-revogado",
        title: "Curso revogado",
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());
    const cardMarkup = getCardMarkup(markup, "Curso revogado");

    expect(markup).toContain("Acesso requer suporte");
    expect(markup).not.toContain("Em breve");
    expect(cardMarkup).toContain("Acesso encerrado");
    expect(cardMarkup).toContain("Falar com suporte");
    expect(cardMarkup).not.toContain("Inscrições pausadas");
  });

  it("keeps normal active access neutral instead of using the default orange badge", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "active",
        availabilityPreset: "available",
        courseId: "course-active",
        expiresAt: new Date(Date.now() + 90 * 86_400_000),
        launchDate: null,
        progressPercent: 40,
        slug: "curso-ativo",
        title: "Curso ativo",
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());

    expect(markup).toContain("Matriculado");
    expect(markup).toContain('data-variant="secondary"');
  });

  it("keeps expiring and completed access semantically distinct", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "active",
        availabilityPreset: "available",
        completedCount: 1,
        courseId: "course-expiring",
        expiresAt: new Date(Date.now() + 5 * 86_400_000),
        launchDate: null,
        progressPercent: 40,
        slug: "curso-expirando",
        title: "Curso expirando",
        totalCount: 1,
      },
      {
        ...course,
        accessStatus: "active",
        availabilityPreset: "available",
        completedCount: 1,
        courseId: "course-completed",
        expiresAt: new Date(Date.now() + 90 * 86_400_000),
        launchDate: null,
        progressPercent: 100,
        slug: "curso-concluido",
        title: "Curso concluído",
        totalCount: 1,
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());
    const expiringCard = getCardMarkup(markup, "Curso expirando");
    const completedCard = getCardMarkup(markup, "Curso concluído");

    expect(expiringCard).toContain("Acesso expira em");
    expect(expiringCard).toContain('data-variant="warning"');
    expect(completedCard).toContain("Curso concluído");
    expect(completedCard).toContain('data-variant="learning"');
  });
});
