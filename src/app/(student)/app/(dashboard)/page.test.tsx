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
  accessStatus: "none",
  availabilityPreset: "coming_soon",
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
  nextLessonId: null,
  priceInCents: 10_000,
  progressPercent: 0,
  revokedReason: null,
  slug: "curso-futuro",
  subtitle: null,
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

  it("renders separate coming-soon and closed-enrollment sections with interest actions", async () => {
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

    expect(markup).toContain("Seu espaço de aprendizagem");
    expect(markup).toContain(
      "Continue seus cursos, descubra novas possibilidades e acompanhe o que está chegando."
    );
    expect(markup).toContain("Chegando em breve");
    expect(markup).toContain(
      "Novas experiências estão sendo preparadas para você."
    );
    expect(markup).toContain("Inscrições em pausa");
    expect(markup).toContain(
      "Este Curso pode voltar em breve. Ative o aviso e fique por perto."
    );
    expect(markup).toContain("Quero ser avisada");
    expect(markup).toContain("Cancelar aviso");
    expect(markup).not.toContain("Ver detalhes");
    expect(markup).not.toContain(
      "Peça um aviso para saber quando as inscrições reabrirem."
    );
    expect(markup).not.toContain("Adquirir acesso");
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
