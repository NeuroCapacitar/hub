import { FinanceHelp } from "@/components/admin/finance-help";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AdminCourseContentSignal } from "@/features/admin/presentation";
import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
} from "@/features/admin/server";
import {
  CourseBuilderWrapper,
  CreateModuleDialog,
} from "./course-builder-components";
import {
  CoursePublicationAction,
  CoursePublicationDiscardAction,
} from "./course-publication-action";

interface CoursePublicationState {
  hasDraft: boolean;
  hasPublished: boolean;
}

interface CourseContentPanelProps {
  canManageContent: boolean;
  contentSignal: AdminCourseContentSignal;
  course: AdminCourse;
  lessons: AdminLesson[];
  modules: AdminModule[];
  nextModuleSortOrder: number;
  publicationState: CoursePublicationState;
}

const CONTENT_SIGNAL_VARIANTS = {
  attention: "destructive",
  healthy: "secondary",
  watch: "outline",
} as const;

const getPublicationLabel = ({
  hasDraft,
  hasPublished,
}: CoursePublicationState): string => {
  if (hasDraft) {
    return "Alterações em preparo";
  }

  if (hasPublished) {
    return "Publicado";
  }

  return "Ainda não publicado";
};

function EmptyCourseContent({
  canManageContent,
  course,
  nextModuleSortOrder,
  publicationState,
}: Pick<
  CourseContentPanelProps,
  "canManageContent" | "course" | "nextModuleSortOrder" | "publicationState"
>) {
  let emptyDescription =
    "O conteúdo está disponível para consulta; alterações ficam restritas às permissões delegadas.";
  if (canManageContent) {
    emptyDescription = publicationState.hasDraft
      ? "Crie a primeira unidade para começar a estruturar o conteúdo do Curso."
      : "Prepare alterações antes de criar a primeira unidade do Curso.";
  }

  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyTitle as="h3">Nenhum módulo cadastrado</EmptyTitle>
        <EmptyDescription>{emptyDescription}</EmptyDescription>
      </EmptyHeader>
      {canManageContent ? (
        <EmptyContent>
          {publicationState.hasDraft ? (
            <CreateModuleDialog
              course={course}
              nextModuleSortOrder={nextModuleSortOrder}
              triggerLabel="Criar primeiro módulo"
            />
          ) : (
            <CoursePublicationAction action="prepare" courseId={course.id} />
          )}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

function CourseContentHelp({
  canManageContent,
  hasDraft,
}: {
  canManageContent: boolean;
  hasDraft: boolean;
}): React.JSX.Element | null {
  if (!canManageContent) {
    return (
      <FinanceHelp
        description="Você pode consultar a estrutura do Curso, mas não possui permissão para alterá-la."
        title="Permissão de conteúdo"
      />
    );
  }

  if (hasDraft) {
    return null;
  }

  return (
    <FinanceHelp
      description="Prepare uma alteração para editar a estrutura atual."
      details={[
        "O conteúdo publicado continua disponível aos alunos até a próxima publicação.",
        "Publicar aplica o conjunto de alterações preparado para o Curso.",
      ]}
      title="Preparação e publicação"
    />
  );
}

function CoursePublicationStatus({
  contentSignal,
  publicationState,
}: Pick<
  CourseContentPanelProps,
  "contentSignal" | "publicationState"
>): React.JSX.Element | null {
  const showContentSignal = contentSignal.tone !== "healthy";
  const publicationLabel = publicationState.hasDraft
    ? null
    : getPublicationLabel(publicationState);

  if (!(publicationLabel || showContentSignal)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {publicationLabel ? (
        <span className="font-medium text-foreground">{publicationLabel}</span>
      ) : null}
      {publicationLabel && showContentSignal ? (
        <span aria-hidden="true" className="text-muted-foreground/60">
          ·
        </span>
      ) : null}
      {showContentSignal ? (
        <Badge variant={CONTENT_SIGNAL_VARIANTS[contentSignal.tone]}>
          {contentSignal.label}
        </Badge>
      ) : null}
    </div>
  );
}

function CourseContentActions({
  canManageContent,
  course,
  hasModules,
  publicationState,
}: Pick<
  CourseContentPanelProps,
  "canManageContent" | "course" | "publicationState"
> & { hasModules: boolean }): React.JSX.Element | null {
  if (!(canManageContent && (hasModules || publicationState.hasDraft))) {
    return null;
  }

  if (!publicationState.hasDraft) {
    return <CoursePublicationAction action="prepare" courseId={course.id} />;
  }

  return (
    <div className="flex w-full shrink-0 flex-wrap gap-2 lg:w-auto lg:justify-end">
      <CoursePublicationDiscardAction courseId={course.id} />
      {hasModules ? (
        <CoursePublicationAction action="publish" courseId={course.id} />
      ) : null}
    </div>
  );
}

function CourseContentHeader({
  canManageContent,
  contentSignal,
  course,
  hasModules,
  publicationState,
}: Pick<
  CourseContentPanelProps,
  "canManageContent" | "contentSignal" | "course" | "publicationState"
> & { hasModules: boolean }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="font-semibold text-xl">Conteúdo do curso</h2>
            {publicationState.hasDraft ? (
              <Badge variant="warning">Alterações em preparo</Badge>
            ) : null}
            <CourseContentHelp
              canManageContent={canManageContent}
              hasDraft={publicationState.hasDraft}
            />
          </div>
          <p className="text-muted-foreground text-sm">
            Organize módulos e aulas e publique todas as alterações em conjunto.
          </p>
        </div>
        <CoursePublicationStatus
          contentSignal={contentSignal}
          publicationState={publicationState}
        />
        {contentSignal.tone === "healthy" ? null : (
          <p className="text-muted-foreground text-sm">
            {contentSignal.helper}
          </p>
        )}
      </div>
      <CourseContentActions
        canManageContent={canManageContent}
        course={course}
        hasModules={hasModules}
        publicationState={publicationState}
      />
    </div>
  );
}

export function CourseContentPanel({
  canManageContent,
  contentSignal,
  course,
  lessons,
  modules,
  nextModuleSortOrder,
  publicationState,
}: CourseContentPanelProps): React.JSX.Element {
  const hasModules = modules.length > 0;

  return (
    <section className="space-y-6">
      <CourseContentHeader
        canManageContent={canManageContent}
        contentSignal={contentSignal}
        course={course}
        hasModules={hasModules}
        publicationState={publicationState}
      />

      {hasModules ? (
        <CourseBuilderWrapper
          course={course}
          editable={canManageContent && publicationState.hasDraft}
          lessons={lessons}
          modules={modules}
          toolbar={
            canManageContent && publicationState.hasDraft ? (
              <CreateModuleDialog
                course={course}
                nextModuleSortOrder={nextModuleSortOrder}
                triggerVariant="outline"
              />
            ) : null
          }
        />
      ) : (
        <EmptyCourseContent
          canManageContent={canManageContent}
          course={course}
          nextModuleSortOrder={nextModuleSortOrder}
          publicationState={publicationState}
        />
      )}
    </section>
  );
}
