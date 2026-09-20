import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  AdminCourseContentSummary,
  AdminCourseOperationalState,
} from "@/features/admin/presentation";
import type { AdminCourseOverviewSummary } from "@/features/admin/server";
import type { AdminStatusPresentation } from "@/features/admin/status-presentation";
import { formatLessonDuration } from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";

interface CourseOverviewProps {
  contentSummary: AdminCourseContentSummary;
  courseAvailability: Pick<AdminStatusPresentation, "label" | "variant">;
  courseId: string;
  durationSeconds: number;
  moduleCount: number;
  operationalState: AdminCourseOperationalState;
  overviewSummary: AdminCourseOverviewSummary;
  previewHref: string;
  publicationState: {
    hasDraft: boolean;
    hasPublished: boolean;
  };
}

const OPERATIONAL_TONE = {
  attention: { label: "Requer atenção", variant: "destructive" },
  healthy: { label: "Operação saudável", variant: "secondary" },
  watch: { label: "Acompanhar", variant: "outline" },
} as const;

const getPublicationLabel = ({
  hasDraft,
  hasPublished,
}: CourseOverviewProps["publicationState"]): string => {
  if (!hasPublished) {
    return "Ainda não publicado";
  }

  if (hasDraft) {
    return "Alterações em preparo";
  }

  return "Publicado";
};

function CourseMetric({
  helper,
  label,
  value,
}: {
  helper: string;
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <Card data-course-metric={label} size="sm">
      <CardContent className="space-y-1">
        <p className="font-medium text-muted-foreground text-sm">{label}</p>
        <p className="font-semibold text-2xl tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs">{helper}</p>
      </CardContent>
    </Card>
  );
}

function CurriculumValue({
  label,
  tabular = false,
  value,
}: {
  label: string;
  tabular?: boolean;
  value: string;
}): React.JSX.Element {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={
          tabular ? "font-medium text-sm tabular-nums" : "font-medium text-sm"
        }
        data-curriculum-value={label}
      >
        {value}
      </dd>
    </div>
  );
}

export function CourseOverview({
  courseAvailability,
  contentSummary,
  courseId,
  durationSeconds,
  moduleCount,
  operationalState,
  overviewSummary,
  publicationState,
  previewHref,
}: CourseOverviewProps): React.JSX.Element {
  const tone = OPERATIONAL_TONE[operationalState.tone];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle as="h2" className="text-xl">
                  {operationalState.label}
                </CardTitle>
                <Badge variant={tone.variant}>{tone.label}</Badge>
              </div>
              <CardDescription>{operationalState.description}</CardDescription>
              {operationalState.actionLabel && operationalState.actionTab ? (
                <Button asChild className="w-full sm:w-auto" size="sm">
                  <Link
                    href={route(
                      `/admin/cursos/${courseId}?tab=${operationalState.actionTab}`
                    )}
                  >
                    {operationalState.actionLabel}
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant={courseAvailability.variant}>
                {courseAvailability.label}
              </Badge>
              <Button asChild size="sm" variant="outline">
                <a href={previewHref}>
                  <HugeiconsIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                    icon={ViewIcon}
                    size={16}
                    strokeWidth={2}
                  />
                  Ver como aluno
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <section
        aria-label="Indicadores do curso"
        className="grid gap-4 md:grid-cols-3"
      >
        <CourseMetric
          helper="Alunos com acesso liberado."
          label="Matrículas ativas"
          value={overviewSummary.activeEnrollmentCount}
        />
        {overviewSummary.paidOrderCount === undefined ? null : (
          <CourseMetric
            helper="Pagamentos confirmados."
            label="Pedidos pagos"
            value={overviewSummary.paidOrderCount}
          />
        )}
        <CourseMetric
          helper="Documentos atualmente válidos."
          label="Certificados válidos"
          value={overviewSummary.validCertificateCount}
        />
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle as="h2">Resumo curricular</CardTitle>
          <CardDescription>
            Estrutura efetiva exibida na publicação do Curso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <CurriculumValue
              label="Módulos"
              tabular
              value={moduleCount.toString()}
            />
            <CurriculumValue
              label="Aulas"
              tabular
              value={contentSummary.totalLessons.toString()}
            />
            <CurriculumValue
              label="Duração"
              tabular
              value={formatLessonDuration(durationSeconds)}
            />
            <CurriculumValue
              label="Publicação"
              value={getPublicationLabel(publicationState)}
            />
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
