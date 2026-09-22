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
import { CourseCoverImage } from "@/features/courses/course-cover-image";
import { getCourseCoverBlurDataUrl } from "@/features/storage/course-cover";
import { requirePermission } from "@/lib/auth-permissions";
import { canPerform } from "@/lib/auth-policy";
import { formatCurrencyInCents } from "@/lib/formatters";
import { route } from "@/lib/routes";

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
      <div className="flex flex-col gap-16">
        <PageHeader title="Cursos" />

        <section className="grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
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

                return (
                  <article
                    className="group relative flex aspect-[24/25] w-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-colors hover:border-border/80"
                    key={course.id}
                  >
                    <div className="absolute inset-0 z-0">
                      {course.thumbnailUrl ? (
                        <CourseCoverImage
                          alt=""
                          blurDataUrl={getCourseCoverBlurDataUrl(
                            course.coverImage
                          )}
                          className="opacity-70 transition-transform duration-400 group-hover:scale-[1.02]"
                          sizes="340px"
                          src={course.thumbnailUrl}
                        />
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-linear-to-br from-card via-card/95 to-secondary/70" />
                          <div className="absolute top-[20%] -right-4 select-none opacity-10 transition-transform duration-400 group-hover:scale-[1.02]">
                            <span className="font-black text-[8rem] leading-none tracking-tighter">
                              {getInitials(course.title)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="absolute inset-0 bg-linear-to-b from-transparent via-card/80 to-card" />
                    </div>

                    <div className="relative z-10 flex min-h-0 flex-1 flex-col p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      <div className="mt-auto pt-10">
                        <h3 className="line-clamp-2 font-bold text-lg">
                          {course.title}
                        </h3>
                        <div className="mt-2 flex items-start justify-end">
                          <div className="shrink-0 pt-0.5 text-right font-medium text-card-foreground/60 text-xs">
                            {course.moduleCount} módulos • {course.lessonCount}{" "}
                            aulas
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 flex shrink-0 flex-col gap-5 p-5 pt-0 sm:p-6 sm:pt-0">
                      <div className="flex items-center justify-between text-muted-foreground text-xs">
                        <span>{course.accessDurationMonths}m acesso</span>
                        <span className="font-semibold text-foreground">
                          {formatCurrencyInCents(course.priceInCents)}
                        </span>
                      </div>

                      <Button
                        asChild
                        className="w-full"
                        size="sm"
                        variant="secondary"
                      >
                        <Link href={route(`/admin/cursos/${course.id}`)}>
                          {canCreateCourse
                            ? "Gerenciar curso"
                            : "Consultar curso"}
                        </Link>
                      </Button>
                    </div>
                  </article>
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
            className="group flex aspect-[24/25] w-full flex-col items-center justify-center rounded-xl border border-border border-dashed bg-card p-6 text-center text-card-foreground outline-none transition-[background-color,border-color,color,scale] duration-150 hover:border-primary/50 hover:bg-muted/20 focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-background active:scale-[0.98]"
            type="button"
          >
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <HugeiconsIcon
                aria-hidden="true"
                icon={Add01Icon}
                size={22}
                strokeWidth={1.75}
              />
            </span>
            <span className="type-card-title">Novo curso</span>
            <span className="mt-2 max-w-[18rem] text-muted-foreground text-sm leading-5">
              Crie um curso para começar a organizar módulos e aulas.
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
