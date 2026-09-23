import {
  BookOpen01Icon,
  CheckmarkCircle02Icon,
  PlayIcon,
  Route03Icon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { getActiveBannersData } from "@/features/banners/server";
import {
  COURSE_CARD_GRID_CLASS,
  CourseCardLayout,
} from "@/features/courses/course-card-layout";
import { CourseCoverImage } from "@/features/courses/course-cover-image";
import { COURSE_COVER_HOVER_ZOOM_CLASS } from "@/features/courses/course-cover-motion";
import { CourseInterestButton } from "@/features/courses/course-interest-button";
import {
  formatCourseWorkloadHours,
  getStudentCatalogAccessPresentation,
  getStudentCoursePrimaryHref,
  groupStudentCatalogCourses,
} from "@/features/courses/presentation";
import { canMutateStudentExperience } from "@/features/courses/preview";
import type { StudentCatalogCourseCard } from "@/features/courses/server";
import { getStudentCourseCatalog } from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ContinueLearningCard } from "./continue-learning-card";
import { CoursePurchaseDialog } from "./course-purchase-dialog";
import { FreeCourseEnrollmentDialog } from "./free-course-enrollment-dialog";
import { StudentBannersCarousel } from "./student-banners-carousel";

export const dynamic = "force-dynamic";

const WHITESPACE_RE = /\s+/;

const getInitials = (title: string): string =>
  title
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

export default async function StudentDashboardPage(): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const courses = await getStudentCourseCatalog(session.user.id);
  const groups = groupStudentCatalogCourses(courses);
  const { banners } = await getActiveBannersData();

  const featuredActiveCourse =
    groups.active.length === 1 &&
    (groups.active[0]?.nextLessonId || groups.active[0]?.nextReleaseAt)
      ? groups.active[0]
      : null;
  let activeCoursesContent: React.JSX.Element | null = null;
  if (featuredActiveCourse) {
    activeCoursesContent = (
      <ContinueLearningCard course={featuredActiveCourse} />
    );
  } else if (groups.active.length > 0) {
    activeCoursesContent = (
      <CourseSection
        courses={groups.active}
        description="Retome sua jornada no ponto em que parou."
        sectionId="student-courses-active"
        title="Continue aprendendo"
      />
    );
  }

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-8">
        {banners.length > 0 && <StudentBannersCarousel banners={banners} />}

        <PageHeader title="Seu espaço de aprendizagem" visibleHeading={false} />

        <div className="flex flex-col gap-12 pt-4">
          {courses.length === 0 ? (
            <EmptyCoursesState />
          ) : (
            <>
              {activeCoursesContent}

              {groups.completed.length > 0 ? (
                <CourseSection
                  courses={groups.completed}
                  description="Suas conquistas seguem disponíveis para revisar quando quiser."
                  sectionId="student-courses-completed"
                  title="Cursos concluídos"
                />
              ) : null}

              <CourseCatalogSection
                availableCourses={groups.available}
                upcomingCourses={groups.upcoming}
              />

              {groups.revoked.length > 0 ? (
                <CourseSection
                  courses={groups.revoked}
                  description="Fale com o suporte para regularizar estes acessos."
                  sectionId="student-courses-revoked"
                  title="Acesso requer suporte"
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function EmptyCoursesState(): React.JSX.Element {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon aria-hidden="true" icon={BookOpen01Icon} />
        </EmptyMedia>
        <EmptyTitle as="h2">Novas experiências estão a caminho</EmptyTitle>
        <EmptyDescription>
          Assim que houver um curso para você, ele aparecerá aqui.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function _getCourseButtonLabel(
  progressPercent: number,
  hasNextLesson: boolean
): string {
  if (progressPercent === 0) {
    return "Iniciar curso";
  }
  if (hasNextLesson) {
    return "Continuar curso";
  }
  return "Rever trilha";
}

function getShortCourseButtonLabel(
  progressPercent: number,
  hasNextLesson: boolean,
  hasFutureRelease: boolean
): string {
  if (hasFutureRelease && !hasNextLesson) {
    return "Aguardando";
  }
  if (progressPercent === 0) {
    return "Iniciar";
  }
  if (hasNextLesson) {
    return "Continuar";
  }
  return "Rever";
}

function CourseSection({
  courses,
  description,
  sectionId,
  title,
}: {
  courses: StudentCatalogCourseCard[];
  description: string;
  sectionId: string;
  title: string;
}): React.JSX.Element | null {
  if (courses.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={sectionId}>
      <div className="mb-5">
        <h2 className="font-bold text-xl" id={sectionId}>
          {title}
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      </div>
      <CourseGrid courses={courses} />
    </section>
  );
}

function CourseCatalogSection({
  availableCourses,
  upcomingCourses,
}: {
  availableCourses: StudentCatalogCourseCard[];
  upcomingCourses: StudentCatalogCourseCard[];
}): React.JSX.Element | null {
  const hasCatalogCourses =
    availableCourses.length > 0 || upcomingCourses.length > 0;

  if (!hasCatalogCourses) {
    return null;
  }

  return (
    <div className="flex flex-col gap-12">
      <CourseSection
        courses={availableCourses}
        description="Cursos que você pode começar agora."
        sectionId="student-courses-available"
        title="Disponíveis agora"
      />
      <CourseSection
        courses={upcomingCourses}
        description="Acompanhe cursos novos e inscrições que podem reabrir. A etiqueta indica o estado de cada curso."
        sectionId="student-courses-upcoming"
        title="Em breve"
      />
    </div>
  );
}

function CourseGrid({
  courses,
}: {
  courses: StudentCatalogCourseCard[];
}): React.JSX.Element {
  return (
    <div className={COURSE_CARD_GRID_CLASS}>
      {courses.map((course) => (
        <CourseCard course={course} key={course.courseId} />
      ))}
    </div>
  );
}

function _InfoPill({
  icon,
  label,
}: {
  icon: typeof BookOpen01Icon;
  label: string;
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border bg-background/45 px-3 py-2 text-muted-foreground">
      <HugeiconsIcon aria-hidden="true" icon={icon} />
      {label}
    </span>
  );
}

const CATALOG_ACCESS_BADGE_VARIANTS = {
  active: "secondary",
  completed: "learning",
  expiring: "warning",
  locked: "secondary",
  revoked: "secondary",
} as const;

const getCatalogCardBadge = (course: StudentCatalogCourseCard) => {
  const hasActiveAccess = course.accessStatus === "active";
  const canShowAvailabilityBadge =
    course.accessStatus === "none" || course.accessStatus === "expired";

  if (course.availabilityPreset === "coming_soon" && canShowAvailabilityBadge) {
    return { label: "Novo curso", variant: "outline" as const };
  }

  if (
    course.availabilityPreset === "sales_paused" &&
    canShowAvailabilityBadge
  ) {
    return { label: "Inscrições pausadas", variant: "outline" as const };
  }

  const presentation = getStudentCatalogAccessPresentation({
    accessStatus: course.accessStatus,
    expiresAt: course.expiresAt ?? new Date(),
    progressPercent: course.progressPercent,
    revokedReason: course.revokedReason,
  });

  return {
    label: presentation.label,
    variant: hasActiveAccess
      ? CATALOG_ACCESS_BADGE_VARIANTS[presentation.tone]
      : ("outline" as const),
  };
};

function isCourseCardSurfaceInteractive(
  course: StudentCatalogCourseCard
): boolean {
  return course.accessStatus !== "revoked";
}

function CourseCardFallback({
  interactive,
  title,
}: {
  interactive: boolean;
  title: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-linear-to-br from-card via-card/95 to-primary/20",
        interactive && COURSE_COVER_HOVER_ZOOM_CLASS
      )}
    >
      <span
        aria-hidden="true"
        className="select-none font-black text-6xl text-card-foreground/10 leading-none tracking-tight"
      >
        {getInitials(title)}
      </span>
    </div>
  );
}

function CourseCard({
  course,
}: {
  course: StudentCatalogCourseCard;
}): React.JSX.Element {
  const hasActiveAccess = course.accessStatus === "active";
  const isCardInteractive = isCourseCardSurfaceInteractive(course);
  const canOpenOfferDialog =
    !hasActiveAccess &&
    course.accessStatus !== "revoked" &&
    course.availabilityPreset === "available";
  const shouldLinkCardTitle =
    hasActiveAccess ||
    (!canOpenOfferDialog && course.accessStatus !== "revoked");
  const accessBadge = getCatalogCardBadge(course);
  const primaryHref = route(
    getStudentCoursePrimaryHref({
      courseId: course.courseId,
      nextLessonId: course.nextLessonId,
    })
  );
  const cardHref = route(
    hasActiveAccess
      ? `/app/cursos/${course.courseId}`
      : `/comprar/${course.slug}`
  );
  let offerCardTrigger: React.JSX.Element | null = null;

  if (canOpenOfferDialog && course.priceInCents === 0) {
    offerCardTrigger = (
      <FreeCourseEnrollmentDialog
        accessStatus={course.accessStatus === "expired" ? "expired" : "none"}
        certificateEnabled={course.certificateEnabled}
        courseId={course.courseId}
        coverBlurDataUrl={course.coverBlurDataUrl}
        description={course.description}
        lessonCount={course.lessonCount}
        moduleCount={course.moduleCount}
        thumbnailUrl={course.thumbnailUrl}
        title={course.title}
        triggerKind="card"
      />
    );
  } else if (canOpenOfferDialog) {
    offerCardTrigger = (
      <CoursePurchaseDialog course={course} triggerKind="card" />
    );
  }

  const media = (
    <>
      {course.thumbnailUrl ? (
        <CourseCoverImage
          alt=""
          blurDataUrl={course.coverBlurDataUrl}
          sizes="320px"
          src={course.thumbnailUrl}
          zoomOnHover={isCardInteractive}
        />
      ) : (
        <CourseCardFallback
          interactive={isCardInteractive}
          title={course.title}
        />
      )}
      {hasActiveAccess ? null : (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-card-foreground/80 drop-shadow-md"
            icon={SquareLock02Icon}
            size={36}
          />
        </div>
      )}
    </>
  );
  const accessBadgeElement = (
    <Badge
      className={
        hasActiveAccess
          ? "shadow-sm"
          : "border-card-foreground/30 border-dashed bg-card/95 text-card-foreground shadow-sm"
      }
      variant={accessBadge.variant}
    >
      {hasActiveAccess && (
        <HugeiconsIcon
          aria-hidden="true"
          icon={CheckmarkCircle02Icon}
          size={14}
        />
      )}
      {accessBadge.label}
    </Badge>
  );

  return (
    <CourseCardLayout
      interactive={isCardInteractive}
      {...(canOpenOfferDialog
        ? { contentClassName: "pointer-events-none" }
        : {})}
      actions={
        <div className="pointer-events-auto relative z-20">
          <CourseAccessControls
            cardHref={cardHref}
            course={course}
            hasActiveAccess={hasActiveAccess}
            primaryHref={primaryHref}
          />
        </div>
      }
      badge={accessBadgeElement}
      media={media}
      overlay={offerCardTrigger}
    >
      <div className="flex min-h-full min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 className="line-clamp-2 font-bold text-lg leading-6">
            {shouldLinkCardTitle ? (
              <Link className="before:absolute before:inset-0" href={cardHref}>
                {course.title}
              </Link>
            ) : (
              course.title
            )}
          </h3>

          {course.description ? (
            <p className="line-clamp-1 text-card-foreground/70 text-sm leading-5">
              {course.description}
            </p>
          ) : null}

          {course.accessStatus === "none" ? (
            <p className="font-medium text-card-foreground/60 text-xs">
              {course.lessonCount} aulas ·{" "}
              {formatCourseWorkloadHours(course.workloadHours)}
            </p>
          ) : null}
        </div>
        {hasActiveAccess ? (
          <div>
            <div className="mb-2 flex items-center justify-between text-card-foreground/60 text-xs">
              <span>
                {course.completedCount}/{course.totalCount} obrigatórias
              </span>
              <span className="font-semibold text-card-foreground">
                {course.progressPercent}%
              </span>
            </div>
            <Progress
              aria-label={`Progresso no curso ${course.title}: ${course.progressPercent}%`}
              className="h-1"
              tone={course.progressPercent >= 100 ? "complete" : "active"}
              value={course.progressPercent}
            />
          </div>
        ) : null}
      </div>
    </CourseCardLayout>
  );
}

function CourseAccessControls({
  cardHref,
  course,
  hasActiveAccess,
  primaryHref,
}: {
  cardHref: Route;
  course: StudentCatalogCourseCard;
  hasActiveAccess: boolean;
  primaryHref: Route;
}): React.JSX.Element {
  if (hasActiveAccess) {
    return (
      <div className="grid w-full grid-cols-2 gap-2">
        <Button
          asChild
          className="w-full min-w-0 justify-center whitespace-normal"
          size="sm"
        >
          <Link href={primaryHref}>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={PlayIcon}
              size={16}
            />
            {getShortCourseButtonLabel(
              course.progressPercent,
              Boolean(course.nextLessonId),
              Boolean(course.nextReleaseAt)
            )}
          </Link>
        </Button>
        <Button
          asChild
          className="w-full min-w-0 justify-center whitespace-normal"
          size="sm"
          variant="secondary"
        >
          <Link href={cardHref}>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Route03Icon}
              size={16}
            />
            Trilha
          </Link>
        </Button>
      </div>
    );
  }

  if (course.accessStatus === "revoked") {
    return (
      <SupportRequestDialog
        courseTitle={course.title}
        triggerClassName="w-full"
        triggerSize="sm"
      />
    );
  }

  if (
    course.availabilityPreset === "coming_soon" ||
    course.availabilityPreset === "sales_paused"
  ) {
    return (
      <CourseInterestButton
        className="relative z-20 w-full"
        courseId={course.courseId}
        isInterested={course.isInterested}
      />
    );
  }

  return <CoursePurchaseForm course={course} />;
}

function CoursePurchaseForm({
  course,
}: {
  course: StudentCatalogCourseCard;
}): React.JSX.Element {
  if (course.priceInCents === 0) {
    return (
      <FreeCourseEnrollmentDialog
        accessStatus={course.accessStatus === "expired" ? "expired" : "none"}
        certificateEnabled={course.certificateEnabled}
        courseId={course.courseId}
        coverBlurDataUrl={course.coverBlurDataUrl}
        description={course.description}
        lessonCount={course.lessonCount}
        moduleCount={course.moduleCount}
        thumbnailUrl={course.thumbnailUrl}
        title={course.title}
      />
    );
  }

  return <CoursePurchaseDialog course={course} />;
}
