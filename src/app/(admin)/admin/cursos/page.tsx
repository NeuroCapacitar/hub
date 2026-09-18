import { randomUUID } from "node:crypto";
import {
  Add01Icon,
  Book01Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { AdminMutationSubmitButton } from "@/components/admin-mutation-form";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { CourseCoverUploadField } from "@/components/course-cover-upload-field";
import { DiscardAwareDialog } from "@/components/discard-aware-dialog";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCourseAction } from "@/features/admin/actions";
import type { AdminCourse } from "@/features/admin/server";
import { getAdminCourseCatalogData } from "@/features/admin/server";
import { getCourseAvailabilityStatusPresentation } from "@/features/admin/status-presentation";
import { resolveCourseAvailability } from "@/features/courses/availability";
import { CourseCoverImage } from "@/features/courses/course-cover-image";
import { getCourseCoverBlurDataUrl } from "@/features/storage/course-cover";
import { requirePermission } from "@/lib/auth-permissions";
import { canPerform } from "@/lib/auth-policy";
import { formatCurrencyInCents } from "@/lib/formatters";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type CourseData = AdminCourse;

const WHITESPACE_RE = /\s+/;

const getInitials = (title: string): string =>
  title
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

const getCourseResultSummary = ({
  courseCount,
  page,
  pageSize,
  totalCount,
}: {
  courseCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
}): string => {
  if (totalCount === 0) {
    return "Nenhum Curso";
  }
  if (courseCount === 0) {
    return `Nenhum Curso nesta página · ${totalCount} no total`;
  }
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(firstResult + courseCount - 1, totalCount);
  return `${firstResult}–${lastResult} de ${totalCount} Curso${totalCount === 1 ? "" : "s"}`;
};

interface AdminCoursesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const firstSearchParam = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function AdminCoursesPage({
  searchParams,
}: AdminCoursesPageProps): Promise<React.JSX.Element> {
  const session = await requirePermission("viewCourses");
  const canCreateCourse = canPerform(session, "createCourse");
  const params = (await searchParams) ?? {};
  const rawPage = Number.parseInt(firstSearchParam(params.page) ?? "1", 10);
  const data = await getAdminCourseCatalogData({
    page: Number.isFinite(rawPage) ? rawPage : 1,
  });
  const resultSummary = getCourseResultSummary({
    courseCount: data.courses.length,
    page: data.page,
    pageSize: data.pageSize,
    totalCount: data.totalCount,
  });
  const pageHref = (targetPage: number): string => {
    const query = new URLSearchParams();
    query.set("page", String(targetPage));
    return `/admin/cursos?${query.toString()}`;
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader title="Cursos" />

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
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
                          className="opacity-70 transition-transform duration-500 group-hover:scale-105"
                          sizes="340px"
                          src={course.thumbnailUrl}
                        />
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-linear-to-br from-card via-card/95 to-secondary/70" />
                          <div className="absolute top-[20%] -right-4 select-none opacity-10 transition-transform duration-500 group-hover:scale-105">
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
                        <div className="mt-2 flex items-start gap-4">
                          <div className="flex-1">
                            {course.subtitle ? (
                              <p className="line-clamp-2 text-card-foreground/70 text-sm leading-5">
                                {course.subtitle}
                              </p>
                            ) : null}
                          </div>
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span aria-live="polite" className="text-muted-foreground text-sm">
            {resultSummary}
          </span>
          {data.page > 1 || data.hasNextPage ? (
            <nav aria-label="Paginação de Cursos" className="flex gap-2">
              {data.page > 1 ? (
                <Button asChild variant="outline">
                  <Link href={pageHref(data.page - 1)}>Anterior</Link>
                </Button>
              ) : null}
              {data.hasNextPage ? (
                <Button asChild variant="outline">
                  <Link href={pageHref(data.page + 1)}>Próxima</Link>
                </Button>
              ) : null}
            </nav>
          ) : null}
        </div>
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
      description="Crie o curso antes de cadastrar seus módulos e aulas."
      title="Novo curso"
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
      <CourseForm priceFieldId={priceFieldId} />
    </DiscardAwareDialog>
  );
}

function CourseForm({
  course,
  priceFieldId,
}: {
  course?: CourseData;
  priceFieldId: string;
}): React.JSX.Element {
  const aggregateId = course?.id ?? randomUUID();
  const titleFieldId = `${priceFieldId}-title`;
  const subtitleFieldId = `${priceFieldId}-subtitle`;
  const descriptionFieldId = `${priceFieldId}-description`;
  const durationFieldId = `${priceFieldId}-access-duration`;

  return (
    <AutoCloseDialogForm
      action={saveCourseAction}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogBody>
        <FieldGroup>
          <input name="courseId" type="hidden" value={course?.id ?? ""} />
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-[auto_1fr]">
            <Field className="row-span-2 justify-center">
              <CourseCoverUploadField
                aggregateId={aggregateId}
                className="sm:w-[240px]"
                defaultCoverImage={course?.coverImage}
                defaultThumbnailUrl={course?.thumbnailUrl}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={titleFieldId}>Título</FieldLabel>
              <Input
                defaultValue={course?.title ?? ""}
                id={titleFieldId}
                name="title"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={subtitleFieldId}>Subtítulo</FieldLabel>
              <Input
                defaultValue={course?.subtitle ?? ""}
                id={subtitleFieldId}
                name="subtitle"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={descriptionFieldId}>Descrição</FieldLabel>
            <Textarea
              defaultValue={course?.description ?? ""}
              id={descriptionFieldId}
              name="description"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={durationFieldId}>Meses de acesso</FieldLabel>
              <Input
                defaultValue={course?.accessDurationMonths ?? 12}
                id={durationFieldId}
                min={1}
                name="accessDurationMonths"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={priceFieldId}>Preço do curso</FieldLabel>
              <Input
                defaultValue={
                  course ? formatCurrencyInCents(course.priceInCents) : ""
                }
                id={priceFieldId}
                name="price"
                placeholder="497,00"
                required
              />
            </Field>
          </div>
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <AdminMutationSubmitButton className="w-fit" type="submit">
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={course ? FloppyDiskIcon : Add01Icon}
            size={18}
            strokeWidth={2}
          />
          {course ? "Salvar curso" : "Criar curso"}
        </AdminMutationSubmitButton>
      </DialogFooter>
    </AutoCloseDialogForm>
  );
}
