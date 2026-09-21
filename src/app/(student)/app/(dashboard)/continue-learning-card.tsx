import {
  BookOpen01Icon,
  Clock01Icon,
  PlayIcon,
  Route03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CourseCoverImage } from "@/features/courses/course-cover-image";
import { formatCourseWorkload } from "@/features/courses/presentation";
import type { StudentCatalogCourseCard } from "@/features/courses/server";
import { formatDateTime } from "@/lib/formatters";
import { route } from "@/lib/routes";

export function ContinueLearningCard({
  course,
}: {
  course: StudentCatalogCourseCard;
}): React.JSX.Element {
  const hasNextLesson = Boolean(course.nextLessonId && course.nextLessonTitle);
  const hasFutureRelease = Boolean(course.nextReleaseAt) && !hasNextLesson;
  const courseHref = route(`/app/cursos/${course.courseId}`);
  const primaryHref = route(
    hasNextLesson
      ? `/app/aulas/${course.nextLessonId}`
      : `/app/cursos/${course.courseId}`
  );

  return (
    <section aria-labelledby="student-next-step-title">
      <div className="mb-5">
        <h2 className="type-section-title" id="student-next-step-title">
          Continue aprendendo
        </h2>
      </div>

      <article className="overflow-hidden rounded-surface border border-border/70 bg-card text-card-foreground shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <ContinueLearningMedia course={course} />

          <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6 lg:p-8">
            <Badge className="w-fit" variant="secondary">
              Próximo passo
            </Badge>

            <ContinueLearningDetails
              course={course}
              hasFutureRelease={hasFutureRelease}
              hasNextLesson={hasNextLesson}
            />

            <div className="mt-auto flex flex-col gap-4">
              <ContinueLearningProgress course={course} />
              <ContinueLearningActions
                course={course}
                courseHref={courseHref}
                hasNextLesson={hasNextLesson}
                primaryHref={primaryHref}
              />
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

function ContinueLearningMedia({
  course,
}: {
  course: StudentCatalogCourseCard;
}): React.JSX.Element {
  return (
    <div className="relative aspect-[16/10] min-h-52 overflow-hidden bg-muted lg:aspect-auto">
      {course.thumbnailUrl ? (
        <CourseCoverImage
          alt=""
          blurDataUrl={course.coverBlurDataUrl}
          className="object-center"
          sizes="(min-width: 1024px) 40vw, 100vw"
          src={course.thumbnailUrl}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={BookOpen01Icon}
            size={48}
            strokeWidth={1.4}
          />
        </div>
      )}
    </div>
  );
}

function ContinueLearningDetails({
  course,
  hasFutureRelease,
  hasNextLesson,
}: {
  course: StudentCatalogCourseCard;
  hasFutureRelease: boolean;
  hasNextLesson: boolean;
}): React.JSX.Element {
  if (!hasNextLesson) {
    return (
      <div className="min-w-0">
        <h3 className="type-section-title text-balance">{course.title}</h3>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          {hasFutureRelease && course.nextReleaseAt
            ? `A próxima aula estará disponível em ${formatDateTime(course.nextReleaseAt)}.`
            : "Veja a trilha para escolher o próximo conteúdo."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <h3 className="type-section-title text-balance">{course.title}</h3>
      <p className="mt-3 font-medium text-sm">{course.nextLessonTitle}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
        {course.nextModuleTitle ? <span>{course.nextModuleTitle}</span> : null}
        {course.nextModuleTitle && course.nextLessonDurationSeconds ? (
          <span aria-hidden="true">·</span>
        ) : null}
        {course.nextLessonDurationSeconds ? (
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon
              aria-hidden="true"
              icon={Clock01Icon}
              size={15}
              strokeWidth={1.8}
            />
            {formatCourseWorkload(course.nextLessonDurationSeconds)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ContinueLearningProgress({
  course,
}: {
  course: StudentCatalogCourseCard;
}): React.JSX.Element | null {
  if (course.totalCount <= 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-muted-foreground text-xs">
        <span>
          {course.completedCount}/{course.totalCount} obrigatórias
        </span>
        <span className="font-semibold text-foreground tabular-nums">
          {course.progressPercent}%
        </span>
      </div>
      <Progress
        aria-label={`Progresso no curso ${course.title}: ${course.progressPercent}%`}
        className="h-1.5"
        tone={course.progressPercent >= 100 ? "complete" : "active"}
        value={course.progressPercent}
      />
    </div>
  );
}

function ContinueLearningActions({
  course,
  courseHref,
  hasNextLesson,
  primaryHref,
}: {
  course: StudentCatalogCourseCard;
  courseHref: string;
  hasNextLesson: boolean;
  primaryHref: string;
}): React.JSX.Element {
  const primaryLabel = getContinueLearningActionLabel({
    hasNextLesson,
    progressPercent: course.progressPercent,
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild>
        <Link href={primaryHref}>
          {hasNextLesson ? (
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={PlayIcon}
              size={16}
            />
          ) : null}
          {primaryLabel}
        </Link>
      </Button>
      {hasNextLesson ? (
        <Button asChild size="sm" variant="outline">
          <Link href={courseHref}>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={Route03Icon}
              size={16}
            />
            Ver trilha
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function getContinueLearningActionLabel({
  hasNextLesson,
  progressPercent,
}: {
  hasNextLesson: boolean;
  progressPercent: number;
}): string {
  if (!hasNextLesson) {
    return "Ver trilha";
  }

  return progressPercent > 0 ? "Continuar aula" : "Iniciar curso";
}
