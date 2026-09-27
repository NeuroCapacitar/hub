"use client";

import { Add01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import { useEffect, useState } from "react";
import {
  AdminMutationSubmitButton,
  useAdminMutationFormState,
} from "@/components/admin-mutation-form";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { CourseCoverUploadField } from "@/components/course-cover-upload-field";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { saveCourseAction } from "@/features/admin/actions";

const COURSE_PRICE_ERROR_RE = /pre[cç]o do curso inv[aá]lido/i;
const COURSE_DURATION_ERROR_RE = /accessDurationMonths/;
const COURSE_ERROR_FIELDS = ["title", "price", "accessDurationMonths"] as const;

type CourseErrorField = (typeof COURSE_ERROR_FIELDS)[number];

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "Não foi possível criar o curso. Tente novamente.";

const getErrorField = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null || !("field" in error)) {
    return null;
  }

  const field = (error as { field?: unknown }).field;
  return typeof field === "string" ? field : null;
};

const getCourseFieldErrors = (error: unknown): Record<string, string> => {
  const message = getErrorMessage(error);
  const field = getErrorField(error);

  if (field === "title" || message.includes("título do Curso")) {
    return { title: message };
  }

  if (COURSE_PRICE_ERROR_RE.test(message)) {
    return {
      price:
        "Informe 0,00 para um Curso gratuito ou um valor pago a partir de R$ 10,00.",
    };
  }

  if (COURSE_DURATION_ERROR_RE.test(message)) {
    return {
      accessDurationMonths:
        "Informe uma quantidade inteira de meses maior que zero.",
    };
  }

  return {};
};

function RequiredMark(): React.JSX.Element {
  return (
    <>
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
      <span className="sr-only"> obrigatório</span>
    </>
  );
}

function FieldHelp({
  label,
  children,
}: {
  children: React.ReactNode;
  label: string;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className="inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={InformationCircleIcon}
            size={15}
            strokeWidth={2}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        className="max-w-xs p-3 text-xs leading-normal"
        side="top"
        sideOffset={6}
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function CourseCreationFields({
  aggregateId,
  priceFieldId,
  onCoverUploadingChange,
}: {
  aggregateId: string;
  onCoverUploadingChange: (isUploading: boolean) => void;
  priceFieldId: string;
}): React.JSX.Element {
  const { fieldErrors } = useAdminMutationFormState();
  const titleFieldId = `${priceFieldId}-title`;
  const descriptionFieldId = `${priceFieldId}-description`;
  const durationFieldId = `${priceFieldId}-access-duration`;
  const titleErrorId = `${titleFieldId}-error`;
  const priceErrorId = `${priceFieldId}-error`;
  const durationErrorId = `${durationFieldId}-error`;
  const titleError = fieldErrors.title;
  const priceError = fieldErrors.price;
  const durationError = fieldErrors.accessDurationMonths;

  useEffect(() => {
    const firstInvalidField = COURSE_ERROR_FIELDS.find(
      (field) => fieldErrors[field]
    ) as CourseErrorField | undefined;

    if (!firstInvalidField) {
      return;
    }

    const fieldIds: Record<CourseErrorField, string> = {
      accessDurationMonths: durationFieldId,
      price: priceFieldId,
      title: titleFieldId,
    };
    document.getElementById(fieldIds[firstInvalidField])?.focus();
  }, [durationFieldId, fieldErrors, priceFieldId, titleFieldId]);

  return (
    <>
      <input name="courseId" type="hidden" value="" />
      <FieldSet aria-label="Identidade do curso" className="gap-5">
        <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-stretch">
          <Field className="min-w-0">
            <FieldTitle className="items-center">
              <span>Capa do curso</span>
              <FieldHelp label="Ajuda sobre a capa do curso">
                Opcional. Envie PNG, JPG ou WebP de até 4 MiB e ajuste o
                enquadramento em 16:9.
              </FieldHelp>
            </FieldTitle>
            <CourseCoverUploadField
              aggregateId={aggregateId}
              className="mx-auto max-w-[224px] md:mx-0 md:w-[224px]"
              onUploadingChange={onCoverUploadingChange}
            />
          </Field>

          <div className="grid min-w-0 gap-5">
            <Field data-invalid={Boolean(titleError)}>
              <FieldLabel htmlFor={titleFieldId}>
                Título <RequiredMark />
              </FieldLabel>
              <Input
                aria-describedby={titleError ? titleErrorId : undefined}
                aria-invalid={titleError ? true : undefined}
                autoComplete="off"
                id={titleFieldId}
                name="title"
                required
              />
              {titleError ? (
                <FieldError id={titleErrorId}>{titleError}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor={descriptionFieldId}>Descrição</FieldLabel>
              <Textarea
                className="min-h-24 resize-y"
                id={descriptionFieldId}
                name="description"
              />
            </Field>
          </div>
        </div>
      </FieldSet>

      <FieldSeparator />

      <FieldSet aria-label="Configuração inicial" className="gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(priceError)}>
            <div className="flex items-center gap-1.5">
              <FieldLabel htmlFor={priceFieldId}>
                Preço inicial <RequiredMark />
              </FieldLabel>
              <FieldHelp label="Ajuda sobre o preço inicial">
                Use 0,00 para um Curso gratuito. Cursos pagos começam em R$
                10,00; Pix e cartão com até 3x ficam ativos por padrão.
              </FieldHelp>
            </div>
            <Input
              aria-describedby={priceError ? priceErrorId : undefined}
              aria-invalid={priceError ? true : undefined}
              autoComplete="off"
              id={priceFieldId}
              inputMode="decimal"
              name="price"
              placeholder="497,00"
              required
            />
            {priceError ? (
              <FieldError id={priceErrorId}>{priceError}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={Boolean(durationError)}>
            <div className="flex items-center gap-1.5">
              <FieldLabel htmlFor={durationFieldId}>
                Validade do acesso
              </FieldLabel>
              <FieldHelp label="Ajuda sobre a validade do acesso">
                Período de acesso após a concessão. O padrão é 12 meses.
              </FieldHelp>
            </div>
            <Input
              aria-describedby={durationError ? durationErrorId : undefined}
              aria-invalid={durationError ? true : undefined}
              defaultValue={12}
              id={durationFieldId}
              inputMode="numeric"
              min={1}
              name="accessDurationMonths"
              type="number"
            />
            {durationError ? (
              <FieldError id={durationErrorId}>{durationError}</FieldError>
            ) : null}
          </Field>
        </div>
      </FieldSet>
    </>
  );
}

export function CourseCreationForm({
  aggregateId,
  priceFieldId,
}: {
  aggregateId: string;
  priceFieldId: string;
}): React.JSX.Element {
  const [isCoverUploading, setIsCoverUploading] = useState(false);

  return (
    <AutoCloseDialogForm
      action={saveCourseAction}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      getFieldErrors={getCourseFieldErrors}
    >
      <DialogBody className="overscroll-contain">
        <TooltipProvider delayDuration={250}>
          <FieldGroup className="gap-6">
            <CourseCreationFields
              aggregateId={aggregateId}
              onCoverUploadingChange={setIsCoverUploading}
              priceFieldId={priceFieldId}
            />
          </FieldGroup>
        </TooltipProvider>
      </DialogBody>
      <DialogFooter className="sm:justify-between">
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </DialogClose>
        <AdminMutationSubmitButton
          className="w-full sm:w-fit"
          loading={isCoverUploading}
          type="submit"
        >
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={Add01Icon}
            size={18}
            strokeWidth={2}
          />
          Criar curso
        </AdminMutationSubmitButton>
      </DialogFooter>
    </AutoCloseDialogForm>
  );
}
