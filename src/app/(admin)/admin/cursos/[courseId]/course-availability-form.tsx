"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DatePickerField } from "@/components/date-picker-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  archiveCourseAction,
  restoreCourseAction,
} from "@/features/admin/course-availability-actions";
import type { AdminCourse } from "@/features/admin/server";
import {
  type CourseAvailabilityPreset,
  getCourseAvailabilityOptions,
  resolveCourseAvailability,
} from "@/features/courses/availability";

type AvailabilityCourse = Pick<
  AdminCourse,
  | "catalogVisibility"
  | "hasCommercialHistory"
  | "id"
  | "interestCount"
  | "interestNotificationsSent"
  | "launchDate"
  | "launchLandingUrl"
  | "pendingCheckoutCancellations"
  | "pendingInterestNotifications"
  | "salesStatus"
  | "status"
>;

const getPreset = (course: AvailabilityCourse) =>
  resolveCourseAvailability({
    catalogVisibility: course.catalogVisibility,
    deliveryStatus: course.status as "active" | "archived" | "draft",
    salesStatus: course.salesStatus,
  }).preset;

export const getCourseAvailabilityPreset = getPreset;

const formatLaunchDate = (value: string | null): string => {
  if (!value) {
    return "Não definida";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
};

function CourseAvailabilityReadOnly({
  course,
  preset,
  availabilityOptions,
}: {
  course: AvailabilityCourse;
  preset: CourseAvailabilityPreset;
  availabilityOptions: ReturnType<typeof getCourseAvailabilityOptions>;
}): React.JSX.Element {
  const availabilityLabel =
    availabilityOptions.find((option) => option.value === preset)?.label ??
    "Indisponível";

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="font-medium">{availabilityLabel}</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Esta configuração está disponível somente para consulta.
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        {preset === "coming_soon" ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Data prevista</dt>
            <dd className="font-medium text-sm">
              {formatLaunchDate(course.launchDate)}
            </dd>
          </div>
        ) : null}
        {preset === "coming_soon" || preset === "sales_paused" ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Landing externa</dt>
            <dd className="break-all font-medium text-sm">
              {course.launchLandingUrl ?? "Não definida"}
            </dd>
          </div>
        ) : null}
        {preset === "sales_paused" ? (
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Vitrine</dt>
            <dd className="font-medium text-sm">
              {course.catalogVisibility === "listed"
                ? "Exibido na vitrine"
                : "Oculto da vitrine"}
            </dd>
          </div>
        ) : null}
      </dl>

      {course.interestCount > 0 ||
      course.pendingInterestNotifications > 0 ||
      course.interestNotificationsSent > 0 ||
      course.pendingCheckoutCancellations > 0 ? (
        <dl className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Interessadas</dt>
            <dd className="font-medium text-sm tabular-nums">
              {course.interestCount}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Avisos pendentes</dt>
            <dd className="font-medium text-sm tabular-nums">
              {course.pendingInterestNotifications}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Avisos enviados</dt>
            <dd className="font-medium text-sm tabular-nums">
              {course.interestNotificationsSent}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">
              Cancelamentos pendentes
            </dt>
            <dd className="font-medium text-sm tabular-nums">
              {course.pendingCheckoutCancellations}
            </dd>
          </div>
        </dl>
      ) : null}

      {course.hasCommercialHistory ? (
        <p className="text-muted-foreground text-xs">
          Rascunho e Em breve ficam indisponíveis porque este Curso já possui
          histórico comercial.
        </p>
      ) : null}
    </div>
  );
}

export function CourseAvailabilityFields({
  course,
  disabled = false,
  onPresetChange,
  onShowInCatalogChange,
  preset,
  readOnly = false,
  showInCatalog,
}: {
  course: AvailabilityCourse;
  disabled?: boolean;
  onPresetChange: (value: CourseAvailabilityPreset) => void;
  onShowInCatalogChange: (value: boolean) => void;
  preset: ReturnType<typeof getCourseAvailabilityPreset>;
  readOnly?: boolean;
  showInCatalog: boolean;
}): React.JSX.Element {
  const [restoreErrorMessage, setRestoreErrorMessage] = useState<string | null>(
    null
  );
  const [isRestoring, startRestoreTransition] = useTransition();
  const availabilityOptions = getCourseAvailabilityOptions({
    hasCommercialHistory: course.hasCommercialHistory,
  });

  if (preset === "archived") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-medium">Curso arquivado</h3>
          <p className="text-muted-foreground text-sm">
            O histórico foi preservado, mas conteúdo e acesso estão bloqueados.
          </p>
        </div>
        {restoreErrorMessage ? (
          <Alert role="alert" variant="destructive">
            <AlertTitle>Não foi possível restaurar o Curso</AlertTitle>
            <AlertDescription>{restoreErrorMessage}</AlertDescription>
          </Alert>
        ) : null}
        {readOnly ? (
          <p className="text-muted-foreground text-sm">
            Esta configuração está disponível somente para consulta.
          </p>
        ) : (
          <Button
            loading={isRestoring}
            onClick={() => {
              setRestoreErrorMessage(null);
              startRestoreTransition(async () => {
                try {
                  await restoreCourseAction(course.id);
                  toast.success("Curso restaurado com vendas pausadas.");
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : "Não foi possível restaurar o Curso.";
                  setRestoreErrorMessage(message);
                  toast.error(message);
                }
              });
            }}
            type="button"
            variant="outline"
          >
            Restaurar curso
          </Button>
        )}
      </div>
    );
  }

  if (readOnly) {
    return (
      <CourseAvailabilityReadOnly
        availabilityOptions={availabilityOptions}
        course={course}
        preset={preset}
      />
    );
  }

  return (
    <fieldset className="contents" disabled={disabled}>
      <Field>
        <FieldLabel htmlFor="course-availability-preset">
          Situação atual
        </FieldLabel>
        <Select
          name="preset"
          onValueChange={(value) => {
            onPresetChange(value as CourseAvailabilityPreset);
          }}
          value={preset}
        >
          <SelectTrigger id="course-availability-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availabilityOptions.map((option) => (
              <SelectItem
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {course.hasCommercialHistory ? (
          <FieldDescription className="text-xs">
            Rascunho e Em breve estão indisponíveis porque este Curso já possui
            histórico comercial.
          </FieldDescription>
        ) : null}
      </Field>

      {preset === "coming_soon" || preset === "sales_paused" ? (
        <div
          className={
            preset === "coming_soon" ? "grid gap-4 sm:grid-cols-2" : "max-w-xl"
          }
        >
          {preset === "coming_soon" ? (
            <Field>
              <FieldLabel htmlFor="course-launch-date">
                Data prevista
              </FieldLabel>
              <DatePickerField
                defaultValue={course.launchDate ?? ""}
                id="course-launch-date"
                name="launchDate"
                placeholder="Definir data prevista"
              />
              <FieldDescription className="text-xs">
                Definir data prevista é opcional.
              </FieldDescription>
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="course-launch-landing">
              Landing externa
            </FieldLabel>
            <Input
              defaultValue={course.launchLandingUrl ?? ""}
              id="course-launch-landing"
              name="launchLandingUrl"
              placeholder="https://exemplo.com/curso"
              type="url"
            />
          </Field>
        </div>
      ) : null}

      {preset === "sales_paused" ? (
        <Field orientation="horizontal">
          <Switch
            checked={showInCatalog}
            id="course-show-in-catalog"
            onCheckedChange={onShowInCatalogChange}
          />
          <div>
            <FieldLabel htmlFor="course-show-in-catalog">
              Exibir na vitrine
            </FieldLabel>
          </div>
          {showInCatalog ? (
            <input name="showInCatalog" type="hidden" value="on" />
          ) : null}
        </Field>
      ) : null}

      {course.interestCount > 0 ||
      course.pendingInterestNotifications > 0 ||
      course.interestNotificationsSent > 0 ||
      course.pendingCheckoutCancellations > 0 ? (
        <p className="text-muted-foreground text-xs">
          {course.interestCount} interessadas ·{" "}
          {course.pendingInterestNotifications} avisos pendentes ·{" "}
          {course.interestNotificationsSent} enviados ·{" "}
          {course.pendingCheckoutCancellations} cancelamento pendente
        </p>
      ) : null}
    </fieldset>
  );
}

export function CourseRiskZone({
  course,
}: {
  course: AvailabilityCourse;
}): React.JSX.Element | null {
  const [archiveErrorMessage, setArchiveErrorMessage] = useState<string | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  if (course.status === "archived") {
    return null;
  }

  return (
    <>
      {archiveErrorMessage ? (
        <Alert role="alert" variant="destructive">
          <AlertTitle>Não foi possível arquivar o Curso</AlertTitle>
          <AlertDescription>{archiveErrorMessage}</AlertDescription>
        </Alert>
      ) : null}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            disabled={isPending}
            size="sm"
            type="button"
            variant="destructive"
          >
            Arquivar curso
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar este Curso?</AlertDialogTitle>
            <AlertDialogDescription>
              O Curso sairá da vitrine, as vendas serão fechadas e todos os
              alunos perderão acesso até uma restauração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setArchiveErrorMessage(null);
                startTransition(async () => {
                  try {
                    await archiveCourseAction(course.id);
                    toast.success("Curso arquivado.");
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : "Não foi possível arquivar o Curso.";
                    setArchiveErrorMessage(message);
                    toast.error(message);
                  }
                });
              }}
              variant="destructive"
            >
              Arquivar curso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
