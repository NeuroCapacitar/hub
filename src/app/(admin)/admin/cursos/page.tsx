import { randomUUID } from "node:crypto";
import { Add01Icon, Book01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { DiscardAwareDialog } from "@/components/discard-aware-dialog";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getAdminCourseCatalogData } from "@/features/admin/server";
import { getCourseAvailabilityStatusPresentation } from "@/features/admin/status-presentation";
import { resolveCourseAvailability } from "@/features/courses/availability";
import {
  COURSE_CARD_GRID_CLASS,
  CourseCardLayout,
} from "@/features/courses/course-card-layout";
import { CourseCoverImage } from "@/features/courses/course-cover-image";
import { COURSE_COVER_HOVER_ZOOM_CLASS } from "@/features/courses/course-cover-motion";
import { getCourseCoverBlurDataUrl } from "@/features/storage/course-cover";
import { requirePermission } from "@/lib/auth-permissions";
import { canPerform } from "@/lib/auth-policy";
import { formatCurrencyInCents } from "@/lib/formatters";
import { route } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { CourseCreationForm } from "./course-creation-form";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const WHITESPACE_RE = /\s+/;

const getInitials = (title: string): string =>
  title
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

export default async function AdminCoursesPage(): Promise<React.JSX.Element> {
  const session = await requirePermission("viewCourses");
  const canCreateCourse = canPerform(session, "createCourse");
  const data = await getAdminCourseCatalogData();

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader title="Cursos" />

        <section className={COURSE_CARD_GRID_CLASS}>
          {canCreateCourse && data.courses.length > 0 ? (
            <NewCourseCard priceFieldId="new-course-price" />
          ) : null}
          {canCreateCourse && data.courses.length === 0 ? (
            <NewCourseCard priceFieldId="empty-course-price" />
          ) : null}
          {data.courses.length === 0 && !canCreateCourse ? (
            <Empty className="w-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon aria-hidden="true" icon={Book01Icon} />
                </EmptyMedia>
                <EmptyTitle as="h2">Nenhum curso cadastrado</EmptyTitle>
                <EmptyDescription>
                  Nenhum curso disponível para consulta.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {data.courses.length > 0
            ? data.courses.map((course) => {
                const availability = resolveCourseAvailability({
                  catalogVisibility: course.catalogVisibility,
                  deliveryStatus: course.status as
                    | "active"
                    | "archived"
                    | "draft",
                  salesStatus: course.salesStatus,
                });
                const statusInfo = getCourseAvailabilityStatusPresentation(
                  availability.preset
                );
                const media = course.thumbnailUrl ? (
                  <CourseCoverImage
                    alt=""
                    blurDataUrl={getCourseCoverBlurDataUrl(course.coverImage)}
                    sizes="320px"
                    src={course.thumbnailUrl}
                    zoomOnHover
                  />
                ) : (
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center bg-linear-to-br from-card via-card/95 to-secondary/70",
                      COURSE_COVER_HOVER_ZOOM_CLASS
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="select-none font-black text-6xl text-card-foreground/10 leading-none tracking-tight"
                    >
                      {getInitials(course.title)}
                    </span>
                  </div>
                );
                const statusBadge = (
                  <Badge
                    className={
                      statusInfo.variant === "outline"
                        ? "w-fit bg-card/95 text-card-foreground shadow-sm"
                        : "w-fit shadow-sm"
                    }
                    variant={statusInfo.variant}
                  >
                    {statusInfo.label}
                  </Badge>
                );

                return (
                  <CourseCardLayout
                    actions={
                      <Button
                        asChild
                        className="relative z-20 w-full"
                        size="sm"
                        variant="secondary"
                      >
                        <Link href={route(`/admin/cursos/${course.id}`)}>
                          {canCreateCourse
                            ? "Gerenciar curso"
                            : "Consultar curso"}
                        </Link>
                      </Button>
                    }
                    badge={statusBadge}
                    key={course.id}
                    media={media}
                  >
                    <div className="flex min-h-full min-w-0 flex-1 flex-col gap-3">
                      <div className="flex min-w-0 flex-col gap-2">
                        <h3 className="line-clamp-2 font-bold text-lg leading-6">
                          {course.title}
                        </h3>
                        <p className="font-medium text-card-foreground/60 text-xs">
                          {course.moduleCount} módulos · {course.lessonCount}{" "}
                          aulas
                        </p>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                          <span>{course.accessDurationMonths}m de acesso</span>
                          <span className="font-semibold text-foreground">
                            {formatCurrencyInCents(course.priceInCents)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </CourseCardLayout>
                );
              })
            : null}
        </section>
      </div>
    </PageContainer>
  );
}

function NewCourseCard({
  priceFieldId,
}: {
  readonly priceFieldId: string;
}): React.JSX.Element {
  return (
    <DiscardAwareDialog
      description="O curso será criado como rascunho."
      title="Criar curso"
      trigger={
        <DialogTrigger asChild>
          <button
            className="group grid min-h-48 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-surface border border-border border-dashed bg-card p-5 text-left text-card-foreground outline-none transition-[background-color,border-color,color,scale] duration-150 hover:border-primary/50 hover:bg-muted/20 focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-background active:scale-[0.98]"
            type="button"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <HugeiconsIcon
                aria-hidden="true"
                icon={Add01Icon}
                size={22}
                strokeWidth={1.75}
              />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="type-card-title">Novo curso</span>
              <span className="mt-2 max-w-[18rem] text-muted-foreground text-sm leading-5">
                Crie um curso para começar a organizar módulos e aulas.
              </span>
            </span>
          </button>
        </DialogTrigger>
      }
    >
      <CourseCreationForm
        aggregateId={randomUUID()}
        priceFieldId={priceFieldId}
      />
    </DiscardAwareDialog>
  );
}
