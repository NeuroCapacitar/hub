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
  CourseCoverImage: ({ zoomOnHover }: { zoomOnHover?: boolean }) => (
    <div data-cover data-zoom-on-hover={zoomOnHover ? "true" : "false"} />
  ),
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
const COURSE_COPY_SPLIT_RE =
  /<h3 class="line-clamp-2[^"]*">[\s\S]*?<\/h3><p class="line-clamp-1[^"]*">/;

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

    const continueCard = getCardMarkup(markup, "Curso ativo de fundamentos");
    expect(continueCard).toContain(
      "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
    );
    expect(continueCard).toContain("aspect-video");
    expect(continueCard).toContain("rounded-media");
    expect(continueCard).toContain("group-hover:scale-[1.04]");
    expect(continueCard).toContain(
      'class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3"'
    );
    expect(
      continueCard.match(/w-full min-w-0 whitespace-normal/g)
    ).toHaveLength(2);
  });

  it("applies the shared cover zoom to Continue Learning media", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "active",
        availabilityPreset: "available",
        courseId: "course-with-thumbnail",
        expiresAt: new Date("2026-12-31T23:59:59.000Z"),
        isEnrolled: true,
        nextLessonId: "lesson-next",
        nextLessonTitle: "Próxima aula",
        slug: "curso-com-capa",
        thumbnailUrl: "/course.webp",
        title: "Curso com capa",
        totalCount: 2,
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());
    const continueCard = getCardMarkup(markup, "Curso com capa");

    expect(continueCard).toContain('data-zoom-on-hover="true"');
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
        lessonCount: 7,
        nextLessonDurationSeconds: 600,
        nextLessonId: "lesson-next-1",
        nextLessonTitle: "Aula um",
        nextModuleTitle: "Módulo um",
        progressPercent: 20,
        slug: "curso-ativo-1",
        title: "Curso ativo um",
        workloadHours: 5,
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

    const activeCardMarkup = getCardMarkup(markup, "Curso ativo um");
    const statusBadgePosition = activeCardMarkup.indexOf(
      'class="pointer-events-none absolute top-2 left-2 z-20"'
    );
    expect(statusBadgePosition).toBeGreaterThan(-1);
    expect(statusBadgePosition).toBeLessThan(activeCardMarkup.indexOf("<h3"));
    expect(activeCardMarkup).toContain("group-hover:scale-[1.04]");
    expect(activeCardMarkup).toContain('class="grid w-full grid-cols-2 gap-2"');
    expect(activeCardMarkup).toContain("w-full min-w-0 justify-center");
    expect(activeCardMarkup).toContain("0/0 obrigatórias");
    expect(activeCardMarkup).toContain(
      'class="flex min-w-0 flex-1 flex-col gap-2"'
    );
    expect(
      activeCardMarkup.indexOf('class="flex min-w-0 flex-1 flex-col gap-2"')
    ).toBeLessThan(activeCardMarkup.indexOf('role="progressbar"'));
    expect(activeCardMarkup.indexOf("0/0 obrigatórias")).toBeLessThan(
      activeCardMarkup.indexOf("Continuar")
    );
    expect(activeCardMarkup).not.toContain("7 aulas");
    expect(activeCardMarkup).not.toContain("5h");
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
    const cardMarkup = getCardMarkup(markup, "Curso gratuito");

    expect(markup).toContain("Inscrever-se grátis");
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).not.toContain(">Adquirir acesso<");
    expect(cardMarkup).toContain("3 aulas");
    expect(cardMarkup).toContain("2h");
  });

  it("shows the course description inside the student card", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        availabilityPreset: "available",
        courseId: "course-described",
        description: "Uma apresentação breve para orientar o aluno.",
        priceInCents: 15_000,
        slug: "curso-com-descricao",
        title: "Curso com descrição",
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());
    const cardMarkup = getCardMarkup(markup, "Curso com descrição");

    expect(cardMarkup).toContain(
      "Uma apresentação breve para orientar o aluno."
    );
    expect(cardMarkup).toContain("line-clamp-2");
    expect(cardMarkup).toMatch(COURSE_COPY_SPLIT_RE);
    expect(markup).toContain("@container/course-card");
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
    expect(cardMarkup).toContain("pointer-events-auto");
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
    expect(getCardMarkup(markup, "Curso futuro")).toContain(
      'data-variant="outline"'
    );
    expect(getCardMarkup(markup, "Curso pausado")).toContain(
      'data-variant="outline"'
    );
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
        lessonCount: 3,
        slug: "curso-expirado",
        title: "Curso expirado",
        workloadHours: 2,
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());
    const cardMarkup = getCardMarkup(markup, "Curso expirado");

    expect(markup).toContain("Disponíveis agora");
    expect(markup).not.toContain("Acesso requer suporte");
    expect(cardMarkup).toContain("Acesso expirado");
    expect(cardMarkup).toContain("Renovar acesso");
    expect(cardMarkup).not.toContain("3 aulas");
    expect(cardMarkup).not.toContain("2h");
  });

  it("keeps revoked access in a support-only section", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "revoked",
        availabilityPreset: "sales_paused",
        courseId: "course-revoked",
        lessonCount: 4,
        slug: "curso-revogado",
        title: "Curso revogado",
        workloadHours: 6,
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());
    const cardMarkup = getCardMarkup(markup, "Curso revogado");

    expect(markup).toContain("Acesso requer suporte");
    expect(markup).not.toContain("Em breve");
    expect(cardMarkup).toContain("Acesso encerrado");
    expect(cardMarkup).toContain("Falar com suporte");
    expect(cardMarkup).not.toContain("4 aulas");
    expect(cardMarkup).not.toContain("6h");
    expect(cardMarkup).not.toContain("Inscrições pausadas");
  });

  it("hides lesson metrics for completed courses", async () => {
    dependencies.getStudentCourseCatalog.mockResolvedValue([
      {
        ...course,
        accessStatus: "active",
        availabilityPreset: "available",
        completedCount: 4,
        courseId: "course-completed",
        isEnrolled: true,
        lessonCount: 4,
        progressPercent: 100,
        slug: "curso-concluido",
        title: "Curso concluído",
        totalCount: 4,
        workloadHours: 3,
      },
    ]);

    const markup = renderToStaticMarkup(await StudentDashboardPage());
    const cardMarkup = getCardMarkup(markup, "Curso concluído");

    expect(markup).toContain("Cursos concluídos");
    expect(cardMarkup).toContain("Curso concluído");
    expect(cardMarkup).not.toContain("4 aulas");
    expect(cardMarkup).not.toContain("3h");
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

    expect(expiringCard).toContain("Expira em");
    expect(expiringCard).not.toContain("Acesso expira em");
    expect(expiringCard).toContain('data-variant="warning"');
    expect(completedCard).toContain("Curso concluído");
    expect(completedCard).toContain('data-variant="learning"');
  });
});
