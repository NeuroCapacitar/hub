import {
  Alert02Icon,
  Analytics01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  Download01Icon,
  MoreHorizontalIcon,
  PlayCircle02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { AdminMetricCard } from "@/app/(admin)/admin/admin-metric-card";
import { FinanceHelp } from "@/components/admin/finance-help";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import type { LearningAnalyticsPeriod } from "@/features/learning-analytics/period";
import { getLearningAnalyticsPeriodLabel } from "@/features/learning-analytics/period";
import {
  formatLearningAnalyticsHours,
  formatLearningAnalyticsPercent,
  formatLearningAnalyticsPlayingTime,
  getLearningAnalyticsActivityWidth,
} from "@/features/learning-analytics/presentation";
import type {
  LearningAnalyticsActivityScale,
  LearningAnalyticsCourseOption,
  LearningAnalyticsKpis,
  LessonAnalyticsLessonReport,
} from "@/features/learning-analytics/types";
import { route } from "@/lib/routes";
import { LearningAnalyticsFilters } from "./learning-analytics-filters";
import { LessonAnalyticsDetailsSheet } from "./lesson-analytics-details-sheet";

const getCoursePageHref = (
  courseId: string,
  period: LearningAnalyticsPeriod,
  page: number
): string => {
  const params = new URLSearchParams({ courseId, period });
  if (page > 1) {
    params.set("page", String(page));
  }
  return route(`/admin/aprendizagem?${params.toString()}`);
};

const formatLessonPosition = (position: number): string =>
  String(position).padStart(2, "0");

function LearningAnalyticsMoreActions({
  exportHref,
}: {
  exportHref: string | null;
}): React.JSX.Element | null {
  if (!exportHref) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Mais opções do relatório de aprendizagem"
          size="icon"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={MoreHorizontalIcon}
            size={18}
            strokeWidth={2}
          />
          <span className="sr-only">Mais opções</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={exportHref}>
            <HugeiconsIcon
              aria-hidden="true"
              icon={Download01Icon}
              size={16}
              strokeWidth={2}
            />
            Exportar dados
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LearningAnalyticsKpisSection({
  kpis,
}: {
  kpis: LearningAnalyticsKpis;
}): React.JSX.Element {
  const courseViewingValue = kpis.averageCourseViewingPercent;
  const courseViewingLabel = formatLearningAnalyticsPercent(courseViewingValue);
  const courseViewingProgress =
    courseViewingValue === null
      ? null
      : {
          ariaLabel: `Visualização média do Curso: ${courseViewingLabel}`,
          value: courseViewingValue,
        };

  return (
    <section aria-labelledby="learning-report-heading">
      <div className="grid gap-x-4 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          helper="Aulas ativas na publicação vigente."
          icon={BookOpen01Icon}
          label="Aulas no Curso"
          value={String(kpis.lessonCount)}
        />
        <AdminMetricCard
          helper="Aulas com falha no período selecionado."
          icon={Alert02Icon}
          label="Aulas com erro"
          value={String(kpis.lessonsWithErrors)}
        />
        <AdminMetricCard
          helper="Sem início no período selecionado."
          icon={PlayCircle02Icon}
          label="Aulas sem início"
          value={String(kpis.lessonsWithoutStarts)}
        />
        <AdminMetricCard
          helper="Média de visualização do curso por aluno"
          icon={ViewIcon}
          label="Visualização média do Curso"
          value={courseViewingLabel}
          {...(courseViewingProgress
            ? { progress: courseViewingProgress }
            : {})}
        />
      </div>
    </section>
  );
}

function LearningAnalyticsPauseInsights({
  courseId,
  insights,
  lessonPageSize,
  period,
}: {
  courseId: string;
  insights: LessonAnalyticsLessonReport[];
  lessonPageSize: number;
  period: LearningAnalyticsPeriod;
}): React.JSX.Element | null {
  if (insights.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="learning-pause-insights-heading">
      <div className="mb-6">
        <h2 className="type-section-title" id="learning-pause-insights-heading">
          Pausas observadas
        </h2>
        <p className="type-body-sm mt-1 text-muted-foreground">
          Medianas observadas entre a conclusão e o início da próxima Aula no
          período. Não representam bloqueio do Curso.
        </p>
      </div>
      <div className="divide-y divide-border/50 rounded-surface border bg-card">
        {insights.map((lesson) => {
          const lessonPage = Math.ceil(lesson.position / lessonPageSize);
          const lessonHref =
            getCoursePageHref(courseId, period, lessonPage) +
            "#lesson-row-" +
            String(lesson.position);

          return (
            <div
              className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={lesson.curriculumKey}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">
                  Aula {formatLessonPosition(lesson.position)} ·{" "}
                  {lesson.lessonTitle}
                </p>
                <p className="mt-1 truncate text-muted-foreground text-xs">
                  {lesson.moduleTitle}
                </p>
                <p className="mt-2 text-muted-foreground text-xs">
                  Mediana observada:{" "}
                  {formatLearningAnalyticsHours(
                    lesson.aggregate.medianHoursToNextLesson
                  )}{" "}
                  · n={lesson.aggregate.nextLessonTimingSampleCount} observações
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={lessonHref}>
                  Ver na tabela
                  <HugeiconsIcon
                    aria-hidden="true"
                    data-icon="inline-end"
                    icon={ArrowRight01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LearningAnalyticsLessonsTable({
  activityScale,
  course,
  lessons,
  page,
  period,
  totalLessonCount,
  totalPages,
}: {
  activityScale: LearningAnalyticsActivityScale;
  course: LearningAnalyticsCourseOption;
  lessons: LessonAnalyticsLessonReport[];
  page: number;
  period: LearningAnalyticsPeriod;
  totalLessonCount: number;
  totalPages: number;
}): React.JSX.Element {
  return (
    <div className="grid gap-3">
      <p
        className="type-meta text-muted-foreground"
        id="learning-activity-note"
      >
        Atividade: inícios e conclusões registrados no período; não é uma taxa
        de conclusão.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <Table
          aria-describedby="learning-activity-note"
          className="min-w-[960px]"
        >
          <TableCaption className="sr-only">
            Desempenho das Aulas do Curso {course.title}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Ordem</TableHead>
              <TableHead>Aula</TableHead>
              <TableHead className="min-w-[220px]">Atividade</TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Checkpoint
              </TableHead>
              <TableHead
                className="whitespace-nowrap text-right"
                title="Soma da reprodução normal registrada no período"
              >
                Tempo reproduzido
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Erros
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Até concluir
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Até próxima Aula
              </TableHead>
              <TableHead className="text-right">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.length > 0 ? (
              lessons.map((lesson) => (
                <TableRow
                  id={`lesson-row-${lesson.position}`}
                  key={lesson.curriculumKey}
                >
                  <TableCell className="font-mono text-muted-foreground text-xs">
                    Aula {formatLessonPosition(lesson.position)}
                  </TableCell>
                  <TableRowHeader>
                    <div className="min-w-48">
                      <p className="font-medium text-sm">
                        {lesson.lessonTitle}
                      </p>
                      <p className="mt-1 text-muted-foreground text-xs">
                        {lesson.moduleTitle}
                      </p>
                    </div>
                  </TableRowHeader>
                  <TableCell>
                    <LessonActivityCell lesson={lesson} scale={activityScale} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLearningAnalyticsPercent(
                      lesson.aggregate.medianCheckpointPercent
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLearningAnalyticsPlayingTime(
                      lesson.aggregate.playingSeconds
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lesson.aggregate.errorCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLearningAnalyticsHours(
                      lesson.aggregate.medianHoursToComplete
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLearningAnalyticsHours(
                      lesson.aggregate.medianHoursToNextLesson
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <LessonAnalyticsDetailsSheet
                      lesson={lesson}
                      period={period}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-56 p-0" colSpan={9}>
                  <Empty className="rounded-none border-0 p-8">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={Analytics01Icon}
                        />
                      </EmptyMedia>
                      <EmptyTitle as="h3">
                        Nenhuma Aula na publicação vigente
                      </EmptyTitle>
                      <EmptyDescription>
                        Publique ou ative as Aulas do Curso para começar a
                        acompanhar o relatório.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {totalLessonCount > 0 && (page > 1 || page < totalPages) ? (
        <div className="flex justify-end">
          <nav
            aria-label="Paginação do relatório de aprendizagem"
            className="flex gap-2"
          >
            {page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <a href={getCoursePageHref(course.id, period, page - 1)}>
                  Anterior
                </a>
              </Button>
            ) : null}
            {page < totalPages ? (
              <Button asChild size="sm" variant="outline">
                <a href={getCoursePageHref(course.id, period, page + 1)}>
                  Próxima
                </a>
              </Button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </div>
  );
}

function LessonActivityCell({
  lesson,
  scale,
}: {
  lesson: LessonAnalyticsLessonReport;
  scale: LearningAnalyticsActivityScale;
}): React.JSX.Element {
  return (
    <div className="grid min-w-[220px] gap-1.5 py-0.5">
      <LessonActivityBar
        label="Inícios"
        maximum={scale.maxValue}
        value={lesson.aggregate.started}
        variant="started"
      />
      <LessonActivityBar
        label="Conclusões"
        maximum={scale.maxValue}
        value={lesson.aggregate.completed}
        variant="completed"
      />
    </div>
  );
}

function LessonActivityBar({
  label,
  maximum,
  value,
  variant,
}: {
  label: string;
  maximum: number;
  value: number;
  variant: "completed" | "started";
}): React.JSX.Element {
  const width = getLearningAnalyticsActivityWidth(value, maximum);
  const barClassName = variant === "started" ? "bg-chart-1" : "bg-chart-2";

  return (
    <div className="grid grid-cols-[5rem_minmax(4rem,1fr)_auto] items-center gap-2">
      <span className="type-meta text-muted-foreground">{label}</span>
      <span
        aria-hidden="true"
        className="h-1.5 overflow-hidden rounded-full bg-muted/70"
      >
        <span
          className={`block h-full rounded-full ${barClassName}`}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-xs tabular-nums">{value}</span>
    </div>
  );
}

export function LearningAnalyticsReport({
  activityScale,
  course,
  courses,
  exportHref,
  kpis,
  lessonPageSize,
  lessons,
  page,
  period,
  pauseInsights,
  selectedCourseId,
  totalLessonCount,
  totalPages,
}: {
  activityScale: LearningAnalyticsActivityScale;
  course: LearningAnalyticsCourseOption;
  courses: LearningAnalyticsCourseOption[];
  exportHref: string | null;
  kpis: LearningAnalyticsKpis;
  lessonPageSize: number;
  lessons: LessonAnalyticsLessonReport[];
  page: number;
  period: LearningAnalyticsPeriod;
  pauseInsights: LessonAnalyticsLessonReport[];
  selectedCourseId: string;
  totalLessonCount: number;
  totalPages: number;
}): React.JSX.Element {
  return (
    <>
      <section aria-labelledby="learning-report-heading">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="type-section-title" id="learning-report-heading">
                Visão rápida
              </h2>
              <FinanceHelp
                description="Use o resumo e a tabela para identificar Aulas que precisam de revisão e acompanhar o efeito das versões publicadas."
                details={[
                  "Inícios, conclusões e erros são somados entre todas as versões da mesma Aula.",
                  "Visualização média do Curso considera cada Aula ativa: conclusão vale 100%, ausência de registro vale 0% e a fronteira linear validada entra no cálculo.",
                  "Checkpoint e tempos de calendário são medianas calculadas sobre os registros disponíveis no período selecionado. Tempo reproduzido soma a reprodução normal registrada, pode incluir reprises e não representa o tempo até concluir. Eventos brutos ficam disponíveis por até 12 meses.",
                  "Abra Detalhes para comparar cada versão e seu status. Dados de Alunos, Contas e e-mails não aparecem aqui.",
                ]}
                title="Como ler o relatório de aprendizagem"
              />
            </div>
            <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
              {course.title} · Contagens em{" "}
              {getLearningAnalyticsPeriodLabel(period)}. A tabela lista as Aulas
              na ordem do Curso.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <LearningAnalyticsFilters
              courses={courses}
              period={period}
              selectedCourseId={selectedCourseId}
            />
            <LearningAnalyticsMoreActions exportHref={exportHref} />
          </div>
        </div>
      </section>
      <LearningAnalyticsKpisSection kpis={kpis} />
      <LearningAnalyticsPauseInsights
        courseId={course.id}
        insights={pauseInsights}
        lessonPageSize={lessonPageSize}
        period={period}
      />
      <LearningAnalyticsLessonsTable
        activityScale={activityScale}
        course={course}
        lessons={lessons}
        page={page}
        period={period}
        totalLessonCount={totalLessonCount}
        totalPages={totalPages}
      />
    </>
  );
}
