import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CircleDotIcon,
  CircleIcon,
  Clock01Icon,
  Download01Icon,
  ExternalLinkIcon,
  File01Icon,
  FileArchiveIcon,
  FileDownloadIcon,
  FileImageIcon,
  FileLinkIcon,
  Pdf01Icon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { completeLessonAction } from "@/app/(student)/app/actions";
import { IconCircleCheck } from "@/components/custom icons/icon-circle-check";
import { LessonCommentsSection } from "@/components/lesson-comments-section";
import {
  LessonFocusHidden,
  LessonFocusLayout,
  LessonFocusToggle,
} from "@/components/lesson-focus-mode";
import { LessonRichTextRenderer } from "@/components/lesson-rich-text-renderer";
import { LessonVideoPlayer } from "@/components/lesson-video-player";
import { LessonVideoProcessing } from "@/components/lesson-video-processing";
import { LockedNavigationCard } from "@/components/locked-lesson-tooltip";
import { RegisterPreviewCourseId } from "@/components/panel-layout";
import { PanelPageTitle } from "@/components/panel-page-title";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getLessonComments } from "@/features/comments/server";
import type { LessonResource } from "@/features/courses/lesson-content";
import {
  canAccessStudentRoute,
  getPreviewAwareHref,
  getStudentPreviewMode,
  type StudentPreviewMode,
} from "@/features/courses/preview";
import {
  formatResourceFileSize,
  getResourceTypeLabel,
  getResourceExtension as getSharedResourceExtension,
} from "@/features/courses/resource-presentation";
import {
  getStudentLessonWorkspace,
  type StudentLessonData,
} from "@/features/courses/server";
import {
  resolveLessonVideoEmbedUrl,
  toVideoProvider,
} from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LessonPageData = StudentLessonData;
type LessonCommentsData = Awaited<ReturnType<typeof getLessonComments>>;
interface LessonSearchParams {
  busca?: string;
  e2eFault?: string;
  material?: string;
  preview?: string | string[];
}
interface LessonWithModule {
  id: string;
  isAvailable: boolean;
  moduleTitle: string;
  title: string;
}

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<LessonSearchParams>;
}): Promise<React.JSX.Element> {
  const [{ lessonId }, query, session] = await Promise.all([
    params,
    searchParams,
    requireSession(),
  ]);
  const previewMode = getStudentPreviewMode({
    preview: query.preview,
    role: session.role,
  });

  if (process.env.E2E_TEST_MODE === "true" && query.e2eFault === "true") {
    throw new Error("E2E learner experience fault.");
  }

  if (
    !canAccessStudentRoute({
      pathname: `/app/aulas/${lessonId}`,
      previewMode,
      role: session.role,
    })
  ) {
    redirect(route("/admin"));
  }

  const workspace = await getStudentLessonWorkspace({
    lessonId,
    viewer: {
      role: session.role,
      userId: session.user.id,
    },
  });

  if (workspace.kind === "time_locked") {
    redirect(route(`/app/cursos/${workspace.courseId}?module=scheduled`));
  }
  if (workspace.kind === "unavailable") {
    notFound();
  }
  const data = workspace.data;

  const commentsData = await getLessonComments({
    lessonId: data.lesson.id,
    role: session.role,
    userId: session.user.id,
  });
  const lessonView = getLessonViewState({
    data,
    query,
    previewMode,
  });

  return (
    <LessonFocusLayout
      main={
        <>
          <PanelPageTitle
            ancestors={[
              { href: route("/app"), label: "Início" },
              {
                href: route(`/app/cursos/${data.course.id}`),
                label: data.course.title,
              },
            ]}
            title={data.lesson.title}
            visibleHeading
          />
          {previewMode ? (
            <RegisterPreviewCourseId courseId={data.course.id} />
          ) : null}

          <LessonMainContent
            commentsData={commentsData}
            data={data}
            lessonView={lessonView}
            previewMode={previewMode}
          />
        </>
      }
      sidebar={
        <LessonCourseSidebar
          activeLessonId={data.lesson.id}
          isPreview={data.isPreview}
          lessonsCount={lessonView.lessons.length}
          modules={lessonView.visibleModules}
          previewMode={previewMode}
          requiredLessonProgress={data.requiredLessonProgress}
        />
      }
    />
  );
}

function getLessonViewState({
  data,
  previewMode,
  query,
}: {
  data: LessonPageData;
  previewMode: StudentPreviewMode | null;
  query: LessonSearchParams;
}) {
  const lessons = getLessonsWithModule(data);

  return {
    courseHref: route(
      getPreviewAwareHref(`/app/cursos/${data.course.id}`, previewMode)
    ),
    lessons,
    nextLesson: lessons.find(({ id }) => id === data.nextLessonId),
    previousLesson: lessons.find(({ id }) => id === data.previousLessonId),
    videoEmbedUrl: resolveLessonVideoEmbedUrl({
      embedUrl: data.lesson.videoEmbedUrl,
      provider: toVideoProvider(data.lesson.videoProvider),
    }),
    materialUnavailable: query.material === "unavailable",
    visibleModules: getVisibleModules(data, query.busca),
  };
}

function getVisibleModules(data: LessonPageData, busca?: string) {
  const searchQuery = busca?.trim().toLowerCase() ?? "";

  if (!searchQuery) {
    return data.modules;
  }

  return data.modules
    .map((module) => ({
      ...module,
      lessons: module.lessons.filter((lesson) =>
        lesson.title.toLowerCase().includes(searchQuery)
      ),
    }))
    .filter((module) => module.lessons.length > 0);
}

function getLessonsWithModule(data: LessonPageData): LessonWithModule[] {
  return data.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.id,
      isAvailable: lesson.isAvailable,
      moduleTitle: module.title,
      title: lesson.title,
    }))
  );
}

function LessonMainContent({
  commentsData,
  data,
  lessonView,
  previewMode,
}: {
  commentsData: LessonCommentsData;
  data: LessonPageData;
  lessonView: ReturnType<typeof getLessonViewState>;
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  const header = <LessonHeader data={data} previewMode={previewMode} />;
  const mobileCourseNavigation = (
    <LessonCourseMobileNavigation
      activeLessonId={data.lesson.id}
      isPreview={data.isPreview}
      lessonsCount={lessonView.lessons.length}
      modules={lessonView.visibleModules}
      previewMode={previewMode}
      requiredLessonProgress={data.requiredLessonProgress}
    />
  );
  const materialUnavailableAlert = lessonView.materialUnavailable ? (
    <LessonMaterialUnavailableAlert />
  ) : null;

  const footer = (
    <LessonFooter
      data={data}
      lessonView={lessonView}
      previewMode={previewMode}
    />
  );
  const commentsSection = (
    <LessonFocusHidden>
      <LessonCommentsSection
        canComment={!previewMode}
        canModerate={false}
        comments={commentsData.comments}
        context="student"
        lessonId={data.lesson.id}
        totalCount={commentsData.totalCount}
      />
    </LessonFocusHidden>
  );
  const videoProcessing = Boolean(
    data.lesson.videoProvider === "jmvstream" &&
      data.lesson.videoExternalId &&
      !lessonView.videoEmbedUrl
  );

  if (lessonView.videoEmbedUrl) {
    return (
      <div className="flex flex-col">
        <LessonVideoPlayer
          durationSeconds={data.lesson.durationSeconds}
          initialPositionSeconds={
            data.lesson.watchProgress?.resumePositionSeconds ?? 0
          }
          initialWatchedPercent={data.lesson.watchProgress?.watchedPercent ?? 0}
          isPreview={Boolean(previewMode)}
          lessonId={data.lesson.id}
          title={data.lesson.title}
          videoDurationSeconds={data.lesson.videoDurationSeconds}
          videoEmbedUrl={lessonView.videoEmbedUrl}
          videoProvider={data.lesson.videoProvider}
        >
          {header}
          {materialUnavailableAlert}
          {mobileCourseNavigation}
          {data.lesson.contentJson ? (
            <LessonContentFrame
              lesson={data.lesson}
              previewMode={previewMode}
            />
          ) : null}
          <div className="mx-auto w-full max-w-5xl px-5 py-9 sm:px-8 lg:px-0">
            {footer}
          </div>
        </LessonVideoPlayer>
        {commentsSection}
      </div>
    );
  }

  if (videoProcessing) {
    return (
      <div className="flex flex-col">
        {header}
        {materialUnavailableAlert}
        {mobileCourseNavigation}
        <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-0">
          <LessonVideoProcessing
            courseTitle={data.course.title}
            state={data.lesson.videoProcessingState ?? "processing"}
          />
        </div>
        <LessonContentFrame lesson={data.lesson} previewMode={previewMode} />
        <div className="mx-auto w-full max-w-5xl px-5 py-9 sm:px-8 lg:px-0">
          {footer}
        </div>
        {commentsSection}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {header}
      {materialUnavailableAlert}
      {mobileCourseNavigation}
      <LessonContentFrame lesson={data.lesson} previewMode={previewMode} />
      <div className="mx-auto w-full max-w-5xl px-5 py-9 sm:px-8 lg:px-0">
        {footer}
      </div>
      {commentsSection}
    </div>
  );
}

function LessonMaterialUnavailableAlert(): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-0">
      <div
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        role="alert"
      >
        Este material está indisponível no momento. Tente novamente mais tarde
        ou fale com o suporte se o problema continuar.
      </div>
    </div>
  );
}

function LessonHeader({
  data,
  previewMode,
}: {
  data: LessonPageData;
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-8 lg:px-0">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <h1 className="type-section-title min-w-0 flex-1 break-words text-foreground">
            {data.lesson.title}
          </h1>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <LessonFocusToggle />
            {data.lesson.isCompleted ? (
              <Button className="gap-2" disabled size="sm" variant="secondary">
                <IconCircleCheck
                  aria-hidden="true"
                  className="text-learning-complete"
                  data-icon="inline-start"
                />
                Aula concluída
              </Button>
            ) : (
              <CompleteLessonButton
                accessibleLabel="Concluir aula no cabeçalho"
                isPreview={Boolean(previewMode)}
                lessonId={data.lesson.id}
                size="sm"
              />
            )}
          </div>
        </div>

        <p className="w-full text-pretty break-words font-light text-muted-foreground text-sm leading-normal">
          <span className="font-normal text-muted-foreground/80">
            {data.lesson.isRequired === false ? "Opcional" : "Obrigatória"}
          </span>
          {data.lesson.description ? (
            <>
              <span
                aria-hidden="true"
                className="mx-1.5 text-muted-foreground/60"
              >
                ·
              </span>
              {data.lesson.description}
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function LessonFooter({
  data,
  lessonView,
  previewMode,
}: {
  data: LessonPageData;
  lessonView: ReturnType<typeof getLessonViewState>;
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  const hasContent = Boolean(data.lesson.contentJson);

  return (
    <div className="flex flex-col gap-8">
      {hasContent || data.lesson.isCompleted ? (
        <LessonNextStepCard
          courseHref={lessonView.courseHref}
          isCompleted={data.lesson.isCompleted}
          nextLessonId={data.nextLessonId}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <NavigationCard
          lesson={lessonView.previousLesson}
          previewMode={previewMode}
          type="previous"
        />
        <NavigationCard
          lesson={lessonView.nextLesson}
          previewMode={previewMode}
          type="next"
        />
      </div>
    </div>
  );
}

function LessonContentFrame({
  lesson,
  previewMode,
}: {
  lesson: LessonPageData["lesson"];
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  if (lesson.contentJson?.type === "text") {
    const resources =
      "resources" in lesson.contentJson ? lesson.contentJson.resources : [];
    const { document } = lesson.contentJson;

    return (
      <article className="px-5 py-10 sm:px-8 lg:px-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          <div className="max-w-[68ch] text-base leading-8">
            <LessonRichTextRenderer document={document} />
          </div>
          <LessonResources
            lessonId={lesson.id}
            previewMode={previewMode}
            resources={resources ?? []}
          />
        </div>
      </article>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-16 text-center font-light text-muted-foreground sm:px-8 lg:px-0">
      Conteúdo em configuração.
    </div>
  );
}

function LessonResources({
  lessonId,
  previewMode,
  resources,
}: {
  lessonId: string;
  previewMode: StudentPreviewMode | null;
  resources: LessonResource[];
}): React.JSX.Element | null {
  if (resources.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="type-card-title text-foreground">
            Materiais Complementares
          </h2>
          <p className="mt-1 font-light text-muted-foreground text-xs">
            {resources.length}{" "}
            {resources.length === 1
              ? "documento anexado"
              : "documentos anexados"}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {resources.map((resource) => (
          <LessonResourceItem
            key={resource.id}
            lessonId={lessonId}
            previewMode={previewMode}
            resource={resource}
          />
        ))}
      </div>
    </section>
  );
}

function LessonResourceItem({
  lessonId,
  previewMode,
  resource,
}: {
  lessonId: string;
  previewMode: StudentPreviewMode | null;
  resource: LessonResource;
}): React.JSX.Element {
  const displayName = getResourceDisplayName(resource);
  const metadata = getResourceMetadata(resource);
  const href = getLessonResourceHref({ lessonId, previewMode, resource });
  const isExternal = resource.storage !== "r2";

  return (
    <Card className="gap-0 rounded-card bg-card/50 py-0 transition-colors hover:bg-muted/40">
      <CardContent className="px-4 py-1 sm:px-5">
        <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 py-3">
          <ResourceVisual
            lessonId={lessonId}
            previewMode={previewMode}
            resource={resource}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-normal text-sm">
                {displayName.base}
                {displayName.extension ? (
                  <span className="font-light text-muted-foreground">
                    .{displayName.extension}
                  </span>
                ) : null}
              </p>
            </div>
            <p className="mt-1 truncate font-light text-muted-foreground text-xs">
              {metadata}
            </p>
          </div>
          <Button
            asChild
            className="shrink-0 px-2.5"
            size="sm"
            variant="outline"
          >
            <a
              aria-label={isExternal ? "Abrir material" : "Baixar material"}
              href={href}
              rel="noopener"
              target="_blank"
              title={isExternal ? "Abrir material" : "Baixar material"}
            >
              <HugeiconsIcon
                aria-hidden="true"
                data-icon="inline-start"
                icon={isExternal ? ExternalLinkIcon : Download01Icon}
                size={16}
                strokeWidth={1.5}
              />
              {isExternal ? "Abrir" : "Baixar"}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceVisual({
  lessonId,
  previewMode,
  resource,
}: {
  lessonId: string;
  previewMode: StudentPreviewMode | null;
  resource: LessonResource;
}): React.JSX.Element {
  if (resource.storage === "r2" && resource.preview) {
    return (
      <div
        aria-label={`Preview de ${resource.label}`}
        className="aspect-square overflow-hidden rounded-md bg-center bg-cover bg-muted/20"
        role="img"
        style={{
          backgroundImage: `url(${getLessonResourcePreviewHref({
            lessonId,
            previewMode,
            resource,
          })})`,
        }}
      />
    );
  }

  const Icon = getResourceIcon(resource);
  const tone = getResourceTone(resource);

  return (
    <div
      className={cn(
        "flex aspect-square items-center justify-center rounded-md bg-muted/10",
        tone
      )}
    >
      <HugeiconsIcon
        aria-hidden="true"
        icon={Icon}
        size={20}
        strokeWidth={1.5}
      />
    </div>
  );
}

function getLessonResourceHref({
  lessonId,
  previewMode,
  resource,
}: {
  lessonId: string;
  previewMode: StudentPreviewMode | null;
  resource: LessonResource;
}): string {
  if (resource.storage === "r2") {
    return route(
      getPreviewAwareHref(
        `/api/lessons/${lessonId}/resources/${resource.id}/download`,
        previewMode
      )
    ) as string;
  }

  return resource.url;
}

function getLessonResourcePreviewHref({
  lessonId,
  previewMode,
  resource,
}: {
  lessonId: string;
  previewMode: StudentPreviewMode | null;
  resource: Extract<LessonResource, { storage: "r2" }>;
}): string {
  return route(
    getPreviewAwareHref(
      `/api/lessons/${lessonId}/resources/${resource.id}/preview`,
      previewMode
    )
  ) as string;
}

function getResourceExtension(resource: LessonResource): string | null {
  return getSharedResourceExtension(resource);
}

function getResourceDisplayName(resource: LessonResource): {
  base: string;
  extension: string | null;
} {
  const label = resource.label.trim() || "Material da aula";
  const extension = getResourceExtension(resource);

  if (!extension) {
    return { base: label, extension: null };
  }

  const suffix = `.${extension}`;

  return label.toLowerCase().endsWith(suffix)
    ? { base: label.slice(0, -suffix.length) || label, extension }
    : { base: label, extension };
}

function getResourceMetadata(resource: LessonResource): string {
  if (resource.storage !== "r2") {
    return "Link externo";
  }

  return `${getFileTypeLabel(resource)} · ${formatFileSize(resource.sizeBytes)}`;
}

function formatFileSize(sizeBytes: number): string {
  return formatResourceFileSize(sizeBytes);
}

function getFileTypeLabel(resource: LessonResource): string {
  return getResourceTypeLabel(resource);
}

function getResourceIcon(resource: LessonResource) {
  const extension = getResourceExtension(resource);

  if (resource.storage !== "r2") {
    return FileLinkIcon;
  }

  if (resource.contentType.startsWith("image/")) {
    return FileImageIcon;
  }

  if (extension === "pdf") {
    return Pdf01Icon;
  }

  if (extension === "zip") {
    return FileArchiveIcon;
  }

  if (
    extension &&
    ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(extension)
  ) {
    return FileDownloadIcon;
  }

  return File01Icon;
}

function getResourceTone(_resource: LessonResource): string {
  return "bg-muted/50 text-muted-foreground";
}

function LessonNextStepCard({
  courseHref,
  isCompleted,
  nextLessonId,
}: {
  courseHref: Route;
  isCompleted: boolean;
  nextLessonId: string | null;
}): React.JSX.Element | null {
  if (!isCompleted) {
    return null;
  }

  if (!nextLessonId && isCompleted) {
    return (
      <div className="flex justify-end">
        <Button asChild>
          <Link href={courseHref}>Ir para a página do curso</Link>
        </Button>
      </div>
    );
  }

  return null;
}

function LessonCourseSidebar({
  activeLessonId,
  isPreview,
  lessonsCount,
  modules,
  previewMode,
  requiredLessonProgress,
}: {
  activeLessonId: string;
  isPreview: boolean;
  lessonsCount: number;
  modules: LessonPageData["modules"];
  previewMode: StudentPreviewMode | null;
  requiredLessonProgress: LessonPageData["requiredLessonProgress"];
}): React.JSX.Element {
  const progressLabel = getRequiredLessonProgressLabel({
    isPreview,
    progress: requiredLessonProgress,
  });
  const hasRequiredProgress =
    !isPreview && requiredLessonProgress.totalCount > 0;

  return (
    <aside aria-label="Conteúdo do curso" className="h-full">
      <Sidebar
        className="hidden h-full w-[340px] shrink-0 border-l-0 lg:flex"
        collapsible="none"
        side="right"
      >
        <div className="shrink-0 px-3 py-4">
          <Card className="gap-3" size="sm">
            <CardHeader>
              <CardTitle as="h2" className="text-sm">
                Conteúdo do curso
              </CardTitle>
              <CardDescription className="text-sidebar-foreground text-xs">
                {progressLabel}
              </CardDescription>
              <CardAction className="flex flex-col items-end gap-1">
                {hasRequiredProgress ? (
                  <span className="text-sidebar-foreground text-xs tabular-nums">
                    {requiredLessonProgress.percent}%
                  </span>
                ) : null}
                <Badge variant="outline">{lessonsCount} aulas</Badge>
              </CardAction>
            </CardHeader>
            {hasRequiredProgress ? (
              <CardContent className="pt-0">
                <Progress
                  aria-label={`Progresso das aulas obrigatórias: ${requiredLessonProgress.completedCount} de ${requiredLessonProgress.totalCount} concluídas`}
                  className="h-1 bg-muted"
                  tone={
                    requiredLessonProgress.percent >= 100
                      ? "complete"
                      : "active"
                  }
                  value={requiredLessonProgress.percent}
                />
              </CardContent>
            ) : null}
          </Card>
        </div>
        <LessonCourseOutline
          activeLessonId={activeLessonId}
          modules={modules}
          previewMode={previewMode}
        />
      </Sidebar>
    </aside>
  );
}

function LessonCourseMobileNavigation({
  activeLessonId,
  isPreview,
  lessonsCount,
  modules,
  previewMode,
  requiredLessonProgress,
}: {
  activeLessonId: string;
  isPreview: boolean;
  lessonsCount: number;
  modules: LessonPageData["modules"];
  previewMode: StudentPreviewMode | null;
  requiredLessonProgress: LessonPageData["requiredLessonProgress"];
}): React.JSX.Element {
  const progressLabel = getRequiredLessonProgressLabel({
    isPreview,
    progress: requiredLessonProgress,
  });

  return (
    <details className="border-border border-y lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-8">
        <span className="min-w-0 flex-1 truncate">Conteúdo do curso</span>
        <span className="flex min-w-0 max-w-[62%] flex-1 flex-col items-end text-right text-muted-foreground text-xs">
          <span className="max-w-full truncate">{progressLabel}</span>
          <span className="tabular-nums">
            {lessonsCount} aulas
            {isPreview || requiredLessonProgress.totalCount === 0
              ? ""
              : ` · ${requiredLessonProgress.percent}%`}
          </span>
        </span>
      </summary>
      <nav
        aria-label="Conteúdo do curso"
        className="border-border border-t py-2"
      >
        <LessonCourseOutline
          activeLessonId={activeLessonId}
          modules={modules}
          previewMode={previewMode}
        />
      </nav>
    </details>
  );
}

function getRequiredLessonProgressLabel({
  isPreview,
  progress,
}: {
  isPreview: boolean;
  progress: LessonPageData["requiredLessonProgress"];
}): string {
  if (isPreview) {
    return "Prévia sem progresso";
  }

  if (progress.totalCount === 0) {
    return "Sem aulas obrigatórias";
  }

  return `${progress.completedCount} de ${progress.totalCount} obrigatórias`;
}

function LessonCourseOutline({
  activeLessonId,
  modules,
  previewMode,
}: {
  activeLessonId: string;
  modules: LessonPageData["modules"];
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  if (modules.length === 0) {
    return (
      <p className="px-4 py-5 text-sidebar-foreground text-sm">
        Nenhuma aula encontrada para essa busca.
      </p>
    );
  }

  const activeModuleId =
    modules.find((module) =>
      module.lessons.some((lesson) => lesson.id === activeLessonId)
    )?.id ?? "";

  return (
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-2 py-2">
      <TooltipProvider delayDuration={200}>
        <Accordion
          className="rounded-lg border-sidebar-border"
          defaultValue={[activeModuleId]}
          type="multiple"
        >
          {modules.map((module) => (
            <AccordionItem key={module.id} value={module.id}>
              <AccordionTrigger className="gap-3 px-3 py-3 text-sidebar-foreground text-sm hover:no-underline focus:no-underline">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {module.title}
                  </span>
                  <ModuleCompletionStatus module={module} />
                  <ModuleLockStatus module={module} />
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-2 [&_a]:no-underline">
                <SidebarMenu>
                  {module.lessons.map((lesson) => (
                    <LessonSidebarItem
                      activeLessonId={activeLessonId}
                      key={lesson.id}
                      lesson={lesson}
                      previewMode={previewMode}
                    />
                  ))}
                </SidebarMenu>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </TooltipProvider>
    </div>
  );
}

function ModuleLockStatus({
  module,
}: {
  module: LessonPageData["modules"][number];
}): React.JSX.Element | null {
  if (module.releaseState === "time_locked") {
    const availableAt = formatLessonReleaseDate(module.availableAt);
    const tooltip = getModuleLockTooltip(module);

    if (!tooltip) {
      return null;
    }

    return (
      <span
        aria-label={tooltip}
        className="flex shrink-0 items-center gap-1.5 font-normal text-amber-700 text-xs dark:text-amber-300"
        role="img"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span aria-hidden="true" className="inline-flex">
              <HugeiconsIcon
                aria-hidden="true"
                icon={Clock01Icon}
                size={14}
                strokeWidth={2}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={6}>
            {tooltip}
          </TooltipContent>
        </Tooltip>
        <span className="font-normal text-[11px] tabular-nums">
          {availableAt}
        </span>
      </span>
    );
  }

  if (!hasSequenceLockedLessons(module)) {
    return null;
  }

  const tooltip = getModuleLockTooltip(module);

  if (!tooltip) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={tooltip}
          className="flex shrink-0 items-center font-normal text-sidebar-foreground/60 text-xs"
          role="img"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={SquareLock02Icon}
            size={14}
            strokeWidth={2}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function hasSequenceLockedLessons(
  module: LessonPageData["modules"][number]
): boolean {
  return module.lessons.some(
    (lesson) => !(lesson.isAvailable || lesson.isCompleted)
  );
}

function getModuleCompletionLabel(
  module: LessonPageData["modules"][number]
): string | null {
  const requiredLessonsComplete =
    module.requiredLessonCount > 0 &&
    module.completedRequiredLessonCount === module.requiredLessonCount &&
    module.releaseState !== "invalid";

  if (!requiredLessonsComplete) {
    return null;
  }

  return module.pendingOptionalLessonCount > 0
    ? "Obrigatórias concluídas"
    : "Módulo concluído";
}

function getModuleCompletionTooltip(label: string): string {
  if (label === "Obrigatórias concluídas") {
    return "Obrigatórias concluídas. Ainda há aulas opcionais pendentes.";
  }

  return "Módulo concluído.";
}

function getModuleLockTooltip(
  module: LessonPageData["modules"][number]
): string | null {
  if (module.releaseState === "time_locked") {
    return `Este módulo ainda não foi liberado. Liberação prevista: ${formatLessonReleaseDate(module.availableAt)}.`;
  }

  if (hasSequenceLockedLessons(module)) {
    return "Conclua as aulas obrigatórias anteriores para liberar a sequência.";
  }

  return null;
}

function ModuleCompletionStatus({
  module,
}: {
  module: LessonPageData["modules"][number];
}): React.JSX.Element | null {
  const label = getModuleCompletionLabel(module);

  if (!label) {
    return null;
  }

  const tooltip = getModuleCompletionTooltip(label);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={tooltip}
          className="flex shrink-0 items-center text-learning-complete"
          role="img"
        >
          <IconCircleCheck />
        </span>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function CompleteLessonButton({
  accessibleLabel,
  isPreview,
  lessonId,
  size,
}: {
  accessibleLabel: string;
  isPreview: boolean;
  lessonId: string;
  size?: "default" | "sm";
}): React.JSX.Element {
  if (isPreview) {
    return (
      <Button disabled size={size} type="button" variant="secondary">
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={CircleIcon}
          size={16}
          strokeWidth={2}
        />
        Preview sem progresso
      </Button>
    );
  }

  return (
    <form action={completeLessonAction}>
      <input name="lessonId" type="hidden" value={lessonId} />
      <Button
        aria-label={accessibleLabel}
        className="gap-2"
        size={size}
        type="submit"
        variant="secondary"
      >
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={CircleIcon}
          size={16}
          strokeWidth={2}
        />
        Concluir aula
      </Button>
    </form>
  );
}

function NavigationCard({
  lesson,
  previewMode,
  type,
}: {
  lesson: LessonWithModule | undefined;
  previewMode: StudentPreviewMode | null;
  type: "next" | "previous";
}): React.JSX.Element {
  const label = type === "previous" ? "Aula anterior" : "Próxima aula";

  if (!lesson) {
    return (
      <div
        className={cn(
          "flex min-w-0 select-none flex-col rounded-xl border border-border bg-muted/30 p-3 text-muted-foreground sm:p-4",
          type === "previous" ? "items-start text-left" : "items-end text-right"
        )}
      >
        <span
          className={cn(
            "flex w-full min-w-0 flex-col",
            type === "previous"
              ? "items-start text-left"
              : "items-end text-right"
          )}
        >
          <span className="flex max-w-full items-center gap-1.5 text-muted-foreground text-xs">
            {type === "previous" && (
              <HugeiconsIcon
                aria-hidden="true"
                className="shrink-0"
                icon={ArrowLeftIcon}
                size={14}
                strokeWidth={2}
              />
            )}
            <span className="truncate">{label}</span>
            {type === "next" && (
              <HugeiconsIcon
                aria-hidden="true"
                className="shrink-0"
                icon={ArrowRightIcon}
                size={14}
                strokeWidth={2}
              />
            )}
          </span>
          <span className="mt-1 block w-full truncate font-semibold text-muted-foreground text-sm">
            {type === "previous" ? "Você está no início" : "Fim da trilha"}
          </span>
        </span>
      </div>
    );
  }

  if (type === "next" && !lesson.isAvailable) {
    return <LockedNavigationCard label={label} title={lesson.title} />;
  }

  return (
    <Button
      asChild
      className={cn(
        "h-auto min-w-0 rounded-xl p-3 sm:p-4",
        type === "previous"
          ? "justify-start text-left"
          : "justify-end text-right"
      )}
      variant="outline"
    >
      <Link
        className="min-w-0"
        href={route(
          getPreviewAwareHref(`/app/aulas/${lesson.id}`, previewMode)
        )}
      >
        <span
          className={cn(
            "flex w-full min-w-0 flex-1 flex-col",
            type === "previous"
              ? "items-start text-left"
              : "items-end text-right"
          )}
        >
          <span className="flex max-w-full items-center gap-1.5 text-muted-foreground text-xs">
            {type === "previous" && (
              <HugeiconsIcon
                aria-hidden="true"
                className="shrink-0"
                icon={ArrowLeftIcon}
                size={14}
                strokeWidth={2}
              />
            )}
            <span className="truncate">{label}</span>
            {type === "next" && (
              <HugeiconsIcon
                aria-hidden="true"
                className="shrink-0"
                icon={ArrowRightIcon}
                size={14}
                strokeWidth={2}
              />
            )}
          </span>
          <span className="mt-1 block w-full truncate font-semibold text-foreground text-sm">
            {lesson.title}
          </span>
        </span>
      </Link>
    </Button>
  );
}

function LessonSidebarItem({
  activeLessonId,
  lesson,
  previewMode,
}: {
  activeLessonId: string;
  lesson: LessonPageData["modules"][number]["lessons"][number];
  previewMode: StudentPreviewMode | null;
}): React.JSX.Element {
  const isActive = lesson.id === activeLessonId;
  const marker = getLessonMarker({
    isActive,
    isAvailable: lesson.isAvailable,
    isCompleted: lesson.isCompleted,
  });
  const accessibleStatus = getLessonAccessibleStatus(lesson);
  const statusTooltip = getLessonStatusTooltip(lesson, isActive);
  const markerContent = (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center"
    >
      {marker}
    </span>
  );
  const statusMarker = statusTooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>{markerContent}</TooltipTrigger>
      <TooltipContent side="left" sideOffset={6}>
        {statusTooltip}
      </TooltipContent>
    </Tooltip>
  ) : (
    markerContent
  );
  const content = (
    <>
      {statusMarker}
      <span className="min-w-0 flex-1">
        {accessibleStatus ? (
          <span className="sr-only">{accessibleStatus}: </span>
        ) : null}
        <span className="block truncate">{lesson.title}</span>
      </span>
    </>
  );

  const item = lesson.isAvailable ? (
    <SidebarMenuLink
      href={route(getPreviewAwareHref(`/app/aulas/${lesson.id}`, previewMode))}
      isActive={isActive}
    >
      {content}
    </SidebarMenuLink>
  ) : (
    <div
      aria-disabled="true"
      className="flex min-h-9 cursor-default select-none items-center gap-2 rounded-md px-2 py-2 text-sidebar-foreground/60 text-sm"
    >
      {content}
    </div>
  );

  return <SidebarMenuItem>{item}</SidebarMenuItem>;
}

function getLessonStatusTooltip(
  lesson: LessonPageData["modules"][number]["lessons"][number],
  isActive: boolean
): string | null {
  if (lesson.isCompleted) {
    return isActive
      ? "Esta aula já foi concluída. Você está nela agora."
      : "Esta aula já foi concluída.";
  }

  if (!lesson.isAvailable) {
    return "Aula bloqueada.";
  }

  if (isActive) {
    return "Esta é a aula aberta no momento.";
  }

  return null;
}

function getLessonAccessibleStatus({
  isAvailable,
  isCompleted,
}: {
  isAvailable: boolean;
  isCompleted: boolean;
}): string | null {
  if (isCompleted) {
    return "Aula concluída";
  }

  if (!isAvailable) {
    return "Aula bloqueada";
  }

  return null;
}

function formatLessonReleaseDate(value: Date | null): string {
  if (!value) {
    return "após a confirmação do acesso";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

function getLessonMarker({
  isActive,
  isAvailable,
  isCompleted,
}: {
  isActive: boolean;
  isAvailable: boolean;
  isCompleted: boolean;
}): React.JSX.Element {
  if (isCompleted) {
    return <IconCircleCheck className="size-[18px] text-learning-complete" />;
  }

  if (!isAvailable) {
    return (
      <HugeiconsIcon
        aria-hidden="true"
        className="text-sidebar-foreground/50"
        icon={SquareLock02Icon}
        size={14}
        strokeWidth={2}
      />
    );
  }

  if (isActive) {
    return (
      <HugeiconsIcon
        aria-hidden="true"
        className="text-progress-active"
        icon={CircleDotIcon}
        size={16}
        strokeWidth={2}
      />
    );
  }

  return (
    <HugeiconsIcon
      aria-hidden="true"
      className="text-sidebar-foreground/50"
      icon={CircleIcon}
      size={14}
      strokeWidth={1.5}
    />
  );
}
