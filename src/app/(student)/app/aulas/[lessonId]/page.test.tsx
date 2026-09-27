import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  canAccessStudentRoute: vi.fn(),
  getLessonComments: vi.fn(),
  getStudentLessonWorkspace: vi.fn(),
  getStudentPreviewMode: vi.fn(),
  requireSession: vi.fn(),
  resolveLessonVideoEmbedUrl: vi.fn(),
  toVideoProvider: vi.fn(),
}));

vi.mock("@/app/(student)/app/actions", () => ({
  completeLessonAction: vi.fn(),
}));
vi.mock("@/components/lesson-comments-section", () => ({
  LessonCommentsSection: () => null,
}));
vi.mock("@/components/lesson-focus-mode", () => ({
  LessonFocusHidden: ({ children }: { children: ReactNode }) => <>{children}</>,
  LessonFocusLayout: ({ sidebar }: { sidebar: ReactNode }) => <>{sidebar}</>,
  LessonFocusToggle: () => null,
}));
vi.mock("@/components/lesson-rich-text-renderer", () => ({
  LessonRichTextRenderer: () => null,
}));
vi.mock("@/components/lesson-video-player", () => ({
  LessonVideoPlayer: () => null,
}));
vi.mock("@/components/lesson-video-processing", () => ({
  LessonVideoProcessing: () => null,
}));
vi.mock("@/components/locked-lesson-tooltip", () => ({
  LockedNavigationCard: () => null,
}));
vi.mock("@/components/panel-layout", () => ({
  RegisterPreviewCourseId: () => null,
}));
vi.mock("@/components/panel-page-title", () => ({
  PanelPageTitle: () => null,
}));
vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AccordionContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AccordionItem: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
  AccordionTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  SidebarMenu: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => (
    <li>{children}</li>
  ),
  SidebarMenuLink: ({
    children,
    href,
    isActive,
  }: {
    children: ReactNode;
    href: string;
    isActive?: boolean;
  }) => (
    <a aria-current={isActive ? "page" : undefined} href={href}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <span role="tooltip">{children}</span>
  ),
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => (
    <span data-test-tooltip-anchor="true">{children}</span>
  ),
}));
vi.mock("@/features/comments/server", () => ({
  getLessonComments: dependencies.getLessonComments,
}));
vi.mock("@/features/courses/preview", () => ({
  canAccessStudentRoute: dependencies.canAccessStudentRoute,
  getPreviewAwareHref: (href: string) => href,
  getStudentPreviewMode: dependencies.getStudentPreviewMode,
}));
vi.mock("@/features/courses/server", () => ({
  getStudentLessonWorkspace: dependencies.getStudentLessonWorkspace,
}));
vi.mock("@/features/videos/jmvstream", () => ({
  resolveLessonVideoEmbedUrl: dependencies.resolveLessonVideoEmbedUrl,
  toVideoProvider: dependencies.toVideoProvider,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));

import LessonPage from "./page";

const currentLessonId = "lesson-current";
const CURRENT_LESSON_LINK_PATTERN = /<a aria-current="page"[\s\S]*?<\/a>/;

function createLessonWorkspace({
  isPreview = false,
  onlyOptional = false,
  optionalPending = true,
  currentLessonCompleted = false,
  currentLessonAvailable = true,
  requiredLessonProgress,
  progressPercent,
}: {
  isPreview?: boolean;
  onlyOptional?: boolean;
  optionalPending?: boolean;
  currentLessonCompleted?: boolean;
  currentLessonAvailable?: boolean;
  requiredLessonProgress?: {
    completedCount: number;
    percent: number;
    totalCount: number;
  };
  progressPercent?: number;
} = {}) {
  const lesson = (
    id: string,
    title: string,
    isCompleted: boolean,
    isAvailable: boolean,
    isRequired = true
  ) => ({
    durationSeconds: 120,
    id,
    isAvailable,
    isCompleted,
    isRequired,
    sortOrder: 1,
    title,
  });
  const defaultProgress = (() => {
    if (onlyOptional) {
      return { completedCount: 0, percent: 0, totalCount: 0 };
    }
    if (isPreview) {
      return { completedCount: 0, percent: 0, totalCount: 3 };
    }
    if (currentLessonCompleted) {
      return { completedCount: 2, percent: 67, totalCount: 3 };
    }
    return { completedCount: 1, percent: 33, totalCount: 3 };
  })();
  const progress = requiredLessonProgress ?? defaultProgress;

  return {
    data: {
      course: { id: "course-1", title: "Curso de exemplo" },
      isPreview,
      lesson: {
        contentJson: null,
        description: null,
        durationSeconds: 120,
        id: currentLessonId,
        isCompleted: currentLessonCompleted,
        isRequired: !onlyOptional,
        title: "Aula atual",
        videoDurationSeconds: 120,
        videoEmbedUrl: null,
        videoExternalId: null,
        videoProcessingState: null,
        videoProvider: null,
        watchProgress: null,
      },
      modules: [
        {
          availableAt: null,
          completedRequiredLessonCount: isPreview || onlyOptional ? 0 : 1,
          id: "module-complete",
          lessons: [
            lesson(
              "lesson-complete",
              "Aula concluída",
              !(isPreview || onlyOptional),
              true,
              !onlyOptional
            ),
            lesson(
              "lesson-optional",
              "Aula opcional",
              !(isPreview || optionalPending),
              true,
              false
            ),
          ],
          pendingOptionalLessonCount:
            (onlyOptional ? 1 : 0) + (isPreview || optionalPending ? 1 : 0),
          releaseState: "available",
          requiredLessonCount: onlyOptional ? 0 : 1,
          sortOrder: 1,
          title: "Módulo com obrigatórias concluídas",
        },
        {
          availableAt: null,
          completedRequiredLessonCount: currentLessonCompleted ? 1 : 0,
          id: "module-current",
          lessons: [
            lesson(
              currentLessonId,
              "Aula atual",
              currentLessonCompleted,
              currentLessonAvailable,
              !onlyOptional
            ),
            lesson("lesson-available", "Aula disponível", false, true, false),
            lesson(
              "lesson-locked",
              "Aula bloqueada",
              false,
              false,
              !onlyOptional
            ),
          ],
          pendingOptionalLessonCount: 1,
          releaseState: "available",
          requiredLessonCount: onlyOptional ? 0 : 2,
          sortOrder: 2,
          title: "Módulo atual",
        },
        {
          availableAt: null,
          completedRequiredLessonCount: 0,
          id: "module-optional-only",
          lessons: [
            lesson(
              "lesson-optional-only",
              "Aula opcional livre",
              false,
              true,
              false
            ),
          ],
          pendingOptionalLessonCount: 1,
          releaseState: "available",
          requiredLessonCount: 0,
          sortOrder: 3,
          title: "Módulo sem obrigatórias",
        },
      ],
      nextLessonId: null,
      previousLessonId: null,
      progressPercent: progressPercent ?? progress.percent,
      requiredLessonProgress: progress,
    },
    kind: "available",
  };
}

describe("LessonPage course sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.canAccessStudentRoute.mockReturnValue(true);
    dependencies.getLessonComments.mockResolvedValue({
      comments: [],
      totalCount: 0,
    });
    dependencies.getStudentLessonWorkspace.mockResolvedValue(
      createLessonWorkspace()
    );
    dependencies.getStudentPreviewMode.mockReturnValue(null);
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { email: "student@example.test", id: "student-1", name: "Aluno" },
    });
    dependencies.resolveLessonVideoEmbedUrl.mockReturnValue(null);
    dependencies.toVideoProvider.mockReturnValue(null);
  });

  const renderPage = async (): Promise<string> =>
    renderToStaticMarkup(
      await LessonPage({
        params: Promise.resolve({ lessonId: currentLessonId }),
        searchParams: Promise.resolve({}),
      })
    );

  it("distinguishes lesson states and module required completion", async () => {
    const markup = await renderPage();

    expect(markup).toContain("1 de 3 obrigatórias");
    expect(markup).toContain("Obrigatórias concluídas");
    expect(markup).toContain("Aula concluída");
    expect(markup).toContain("Aula bloqueada");
    expect(markup).toContain("Esta aula já foi concluída.");
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("text-learning-complete");
    expect(markup).toContain('data-slot="icon-circle-check"');
    expect(markup).toContain('data-slot="card"');
    expect(markup).toContain('data-slot="card-header"');
    expect(markup).toContain('data-slot="card-action"');
    expect(markup).toContain('data-slot="card-content"');
    expect(markup).toContain("text-progress-active");
    expect(markup).not.toContain("Concluída · Aula concluída");
    expect(markup).not.toContain(">Continue a sequência</span>");
    expect(markup).toContain(
      "Conclua as aulas obrigatórias anteriores para liberar a sequência."
    );
    expect(markup).toContain(
      "Obrigatórias concluídas. Ainda há aulas opcionais pendentes."
    );
    expect(markup).not.toContain('<span data-test-tooltip-anchor="true"><a');
    expect(markup).not.toContain(
      '<span data-test-tooltip-anchor="true"><button'
    );
    expect(markup).not.toContain('href="/app/aulas/lesson-locked"');
    expect(
      markup.match(
        /aria-label="Obrigatórias concluídas\. Ainda há aulas opcionais pendentes\."/g
      )
    ).toHaveLength(1);
  });

  it("avoids presenting a zero-percent bar when no required lessons exist", async () => {
    dependencies.getStudentLessonWorkspace.mockResolvedValue(
      createLessonWorkspace({
        onlyOptional: true,
      })
    );

    const markup = await renderPage();

    expect(markup).toContain("Sem aulas obrigatórias");
    expect(markup).not.toContain(
      'aria-label="Progresso das aulas obrigatórias'
    );
    expect(markup).not.toContain('aria-label="Módulo concluído."');
    expect(markup).not.toContain(
      'aria-label="Obrigatórias concluídas. Ainda há aulas opcionais pendentes."'
    );
  });

  it("labels a module complete only after its optional lessons are also done", async () => {
    dependencies.getStudentLessonWorkspace.mockResolvedValue(
      createLessonWorkspace({ optionalPending: false })
    );

    const markup = await renderPage();

    expect(markup).toContain('aria-label="Módulo concluído."');
    expect(markup).not.toContain(
      'aria-label="Obrigatórias concluídas. Ainda há aulas opcionais pendentes."'
    );
  });

  it("keeps current-location and completion markers independent", async () => {
    dependencies.getStudentLessonWorkspace.mockResolvedValue(
      createLessonWorkspace({ currentLessonCompleted: true })
    );

    const markup = await renderPage();
    const currentLessonLink = markup.match(CURRENT_LESSON_LINK_PATTERN)?.[0];

    expect(currentLessonLink).toContain("text-learning-complete");
    expect(markup).toContain('aria-current="page"');
  });

  it("keeps a locked current lesson visually locked", async () => {
    dependencies.getStudentLessonWorkspace.mockResolvedValue(
      createLessonWorkspace({ currentLessonAvailable: false })
    );

    const markup = await renderPage();
    const currentLessonRowStart = markup.indexOf('<div aria-disabled="true"');
    const currentLessonRowEnd = markup.indexOf("</div>", currentLessonRowStart);
    const currentLessonRow = markup.slice(
      currentLessonRowStart,
      currentLessonRowEnd
    );

    expect(currentLessonRow).toContain("text-sidebar-foreground/50");
    expect(currentLessonRow).not.toContain("text-progress-active");
  });

  it("labels progress as unavailable in student preview", async () => {
    dependencies.getStudentLessonWorkspace.mockResolvedValue(
      createLessonWorkspace({ isPreview: true })
    );

    const markup = await renderPage();

    expect(markup).toContain("Prévia sem progresso");
    expect(markup).not.toContain(
      'aria-label="Progresso das aulas obrigatórias'
    );
    expect(markup).not.toContain("Obrigatórias concluídas");
    expect(markup).not.toContain("Módulo concluído");
  });
});
