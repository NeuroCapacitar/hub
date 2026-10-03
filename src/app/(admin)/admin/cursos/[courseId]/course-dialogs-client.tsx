"use client";

import { AlertCircleIcon, FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CoursePriceInput,
  CoursePricingModeField,
} from "@/components/admin/course-pricing-fields";
import { CourseCoverUploadField } from "@/components/course-cover-upload-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { saveCourseSettingsAction } from "@/features/admin/actions";
import { CourseCoverImage } from "@/features/courses/course-cover-image";
import {
  getEffectiveMaxInstallmentCount,
  MAX_INSTALLMENT_COUNT,
  MIN_INSTALLMENT_COUNT,
} from "@/features/payments/course-payment-offer";
import {
  COURSE_PRICE_FIELD_ERROR_MESSAGE,
  COURSE_PRICING_MODE_ERROR_MESSAGE,
  type CoursePricingMode,
  parseCoursePriceToCents,
  parsePaidCoursePriceToCents,
} from "@/features/payments/course-price";
import { formatCurrencyInCents } from "@/lib/formatters";
import {
  CourseAvailabilityFields,
  getCourseAvailabilityPreset,
} from "./course-availability-form";
import { useCourseTabDirty } from "./course-management-tabs";
import { CourseWorkloadDialog } from "./course-workload-dialog";

export interface CourseData {
  accessDurationMonths: number;
  calculatedWorkloadHours?: number;
  catalogVisibility: "hidden" | "listed";
  certificateSignerName: string | null;
  certificateSignerRole: string | null;
  coverImage?: unknown;
  description: string | null;
  hasCommercialHistory: boolean;
  id: string;
  interestCount: number;
  interestNotificationsSent: number;
  launchDate: string | null;
  launchLandingUrl: string | null;
  paymentAllowCreditCard: boolean;
  paymentAllowPix: boolean;
  paymentMaxInstallmentCount: number;
  pendingCheckoutCancellations: number;
  pendingInterestNotifications: number;
  priceInCents: number;
  salesStatus: "closed" | "open";
  slug: string;
  status: string;
  thumbnailUrl: string | null;
  title: string;
  workloadHours: number;
  workloadHoursOverride: number | null;
}

interface PendingPriceChange {
  formData: FormData;
  priceInCents: number;
}

const INSTALLMENT_OPTIONS = Array.from(
  { length: MAX_INSTALLMENT_COUNT },
  (_, index) => index + MIN_INSTALLMENT_COUNT
);
const COURSE_PRICE_INVALID_MESSAGE_RE = /pre[cç]o do curso inv[aá]lido/i;

type CoursePricingSubmission =
  | { ok: true; priceInCents: number }
  | {
      field: "price" | "pricingMode";
      message: string;
      ok: false;
    };

const getCoursePricingSubmission = (
  formData: FormData
): CoursePricingSubmission => {
  const pricingMode = formData.get("pricingMode");

  if (pricingMode === "free") {
    return { ok: true, priceInCents: 0 };
  }

  if (pricingMode !== "paid") {
    return {
      field: "pricingMode",
      message: COURSE_PRICING_MODE_ERROR_MESSAGE,
      ok: false,
    };
  }

  try {
    return {
      ok: true,
      priceInCents: parsePaidCoursePriceToCents(
        String(formData.get("price") ?? "")
      ),
    };
  } catch {
    return {
      field: "price",
      message: COURSE_PRICE_FIELD_ERROR_MESSAGE,
      ok: false,
    };
  }
};

interface CourseSettingsFailure {
  field: "general" | "price" | "pricingMode";
  message: string;
}

const getCourseSettingsFailure = (error: unknown): CourseSettingsFailure => {
  const rawMessage =
    error instanceof Error ? error.message : "Não foi possível salvar o curso.";

  if (
    rawMessage === COURSE_PRICE_FIELD_ERROR_MESSAGE ||
    COURSE_PRICE_INVALID_MESSAGE_RE.test(rawMessage)
  ) {
    return { field: "price", message: COURSE_PRICE_FIELD_ERROR_MESSAGE };
  }

  if (rawMessage === COURSE_PRICING_MODE_ERROR_MESSAGE) {
    return {
      field: "pricingMode",
      message: COURSE_PRICING_MODE_ERROR_MESSAGE,
    };
  }

  return { field: "general", message: rawMessage };
};

const applyCourseSettingsFailure = (
  failure: CourseSettingsFailure,
  setErrorMessage: (message: string | null) => void,
  setPriceError: (message: string | null) => void,
  setPricingModeError: (message: string | null) => void
): void => {
  switch (failure.field) {
    case "price":
      setPriceError(failure.message);
      setPricingModeError(null);
      setErrorMessage(null);
      return;
    case "pricingMode":
      setPricingModeError(failure.message);
      setPriceError(null);
      setErrorMessage(null);
      return;
    default:
      setErrorMessage(failure.message);
  }
};

const submitCourseSettings = ({
  currentPriceInCents,
  formData,
  onInvalidPrice,
  onInvalidPricingMode,
  onPriceChange,
  readOnly,
  save,
}: {
  currentPriceInCents: number;
  formData: FormData;
  onInvalidPrice: () => void;
  onInvalidPricingMode: () => void;
  onPriceChange: (formData: FormData, priceInCents: number) => void;
  readOnly: boolean;
  save: (formData: FormData) => void;
}): void => {
  if (readOnly) {
    save(formData);
    return;
  }

  const pricingSubmission = getCoursePricingSubmission(formData);
  if (!pricingSubmission.ok) {
    if (pricingSubmission.field === "price") {
      onInvalidPrice();
    } else {
      onInvalidPricingMode();
    }
    return;
  }

  if (pricingSubmission.priceInCents !== currentPriceInCents) {
    onPriceChange(formData, pricingSubmission.priceInCents);
    return;
  }

  save(formData);
};

const formatCoursePriceChangeLabel = (priceInCents: number): string =>
  priceInCents === 0
    ? "Gratuito"
    : `Pago (${formatCurrencyInCents(priceInCents)})`;

function ReadOnlyValue({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="break-words font-medium text-sm">{value}</dd>
    </div>
  );
}

function CourseSettingsReadOnly({
  course,
  includeResponsible = true,
  includeAvailability = true,
}: {
  course: CourseData;
  includeAvailability?: boolean;
  includeResponsible?: boolean;
}): React.JSX.Element {
  const effectiveWorkloadHours =
    course.workloadHoursOverride ??
    course.calculatedWorkloadHours ??
    course.workloadHours;
  const paymentMethods = [
    course.paymentAllowPix ? "Pix" : null,
    course.paymentAllowCreditCard ? "cartão" : null,
  ].filter(Boolean);
  const isFreeCourse = course.priceInCents === 0;

  return (
    <div className="flex flex-col gap-8" data-course-settings-readonly="true">
      <p className="rounded-lg border bg-muted/20 px-4 py-3 text-muted-foreground text-sm">
        Você pode consultar os dados gerais, mas não possui permissão para
        alterá-los.
      </p>

      <section className="space-y-5">
        <h3 className="font-medium text-base">Identidade do curso</h3>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-center">
          <div className="relative aspect-video max-w-[320px] overflow-hidden rounded-media border bg-muted">
            {course.thumbnailUrl ? (
              <CourseCoverImage
                alt=""
                blurDataUrl={null}
                sizes="320px"
                src={course.thumbnailUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-muted-foreground text-xs">
                Sem capa definida
              </div>
            )}
          </div>
          <dl className="grid min-w-0 gap-5">
            <ReadOnlyValue label="Título" value={course.title} />
            <ReadOnlyValue
              label="Descrição"
              value={course.description || "Sem descrição definida"}
            />
          </dl>
        </div>
      </section>

      <Separator />

      <section className="space-y-5">
        <h3 className="font-medium text-base">Acesso e carga horária</h3>
        <dl className="grid max-w-2xl gap-5 md:grid-cols-2">
          <ReadOnlyValue
            label="Carga horária"
            value={`${effectiveWorkloadHours} horas`}
          />
          <ReadOnlyValue
            label="Meses de acesso"
            value={`${course.accessDurationMonths} meses`}
          />
        </dl>
      </section>

      <Separator />

      <section className="space-y-5">
        <h3 className="font-medium text-base">Oferta de pagamento</h3>
        <dl className="grid max-w-2xl gap-5 md:grid-cols-2">
          <ReadOnlyValue
            label="Preço do curso"
            value={
              isFreeCourse
                ? "Gratuito"
                : formatCurrencyInCents(course.priceInCents)
            }
          />
          {isFreeCourse ? (
            <ReadOnlyValue
              label="Inscrição"
              value="Feita diretamente pelo Hub"
            />
          ) : (
            <>
              <ReadOnlyValue
                label="Formas de pagamento"
                value={
                  paymentMethods.length > 1
                    ? `${paymentMethods[0]} e ${paymentMethods[1]}`
                    : (paymentMethods[0] ?? "Não configuradas")
                }
              />
              <ReadOnlyValue
                label="Máximo de parcelas"
                value={`${course.paymentMaxInstallmentCount}x`}
              />
            </>
          )}
        </dl>
      </section>

      {includeResponsible ? (
        <>
          <Separator />
          <CourseResponsibleReadOnly course={course} />
        </>
      ) : null}

      {includeAvailability ? (
        <>
          <Separator />
          <section className="space-y-5">
            <h3 className="font-medium text-base">Disponibilidade</h3>
            <CourseAvailabilityFields
              course={course}
              onPresetChange={() => undefined}
              onShowInCatalogChange={() => undefined}
              preset={getCourseAvailabilityPreset(course)}
              readOnly
              showInCatalog={course.catalogVisibility === "listed"}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function CourseResponsibleReadOnly({
  course,
}: {
  course: CourseData;
}): React.JSX.Element {
  return (
    <section className="space-y-5">
      <h3 className="font-medium text-base">Responsável</h3>
      <dl className="grid max-w-2xl gap-5 sm:grid-cols-2">
        <ReadOnlyValue
          label="Nome do responsável"
          value={course.certificateSignerName || "Não informado"}
        />
        <ReadOnlyValue
          label="Cargo ou título"
          value={course.certificateSignerRole || "Não informado"}
        />
      </dl>
    </section>
  );
}

const getCourseSettingsSuccessMessage = (
  result: Extract<
    Awaited<ReturnType<typeof saveCourseSettingsAction>>,
    { ok: true }
  >,
  availabilitySaved: boolean
): string => {
  if (!availabilitySaved) {
    return "Configurações salvas com sucesso!";
  }

  const availabilityFeedback: string[] = [];
  if (result.notificationsEnqueued > 0) {
    const count = result.notificationsEnqueued;
    availabilityFeedback.push(
      `${count} ${count === 1 ? "aviso" : "avisos"} de interesse ${count === 1 ? "enfileirado" : "enfileirados"}`
    );
  }
  if (result.checkoutCancellationsEnqueued > 0) {
    const count = result.checkoutCancellationsEnqueued;
    availabilityFeedback.push(
      `${count} ${count === 1 ? "checkout" : "checkouts"} ${count === 1 ? "enfileirado" : "enfileirados"} para cancelamento`
    );
  }

  return availabilityFeedback.length > 0
    ? `Configurações salvas. ${availabilityFeedback.join("; ")}.`
    : "Configurações salvas com sucesso!";
};

function CourseResponsibleFields({
  course,
  disabled,
  name,
  onNameChange,
  onTitleChange,
  readOnly,
  title,
}: {
  course: CourseData;
  disabled: boolean;
  name: string;
  onNameChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  readOnly: boolean;
  title: string;
}): React.JSX.Element {
  return (
    <section className="space-y-5">
      <h3 className="font-medium text-base">Responsável</h3>
      {readOnly ? (
        <dl className="grid max-w-2xl gap-5 sm:grid-cols-2">
          <ReadOnlyValue
            label="Nome do responsável"
            value={course.certificateSignerName || "Não informado"}
          />
          <ReadOnlyValue
            label="Cargo ou título"
            value={course.certificateSignerRole || "Não informado"}
          />
        </dl>
      ) : (
        <fieldset className="contents" disabled={disabled}>
          <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="course-settings-responsible-name">
                Nome do responsável
              </FieldLabel>
              <Input
                autoComplete="name"
                id="course-settings-responsible-name"
                maxLength={160}
                name="responsibleName"
                onChange={(event) => {
                  onNameChange(event.currentTarget.value);
                }}
                value={name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="course-settings-responsible-title">
                Cargo ou título
              </FieldLabel>
              <Input
                autoComplete="organization-title"
                id="course-settings-responsible-title"
                maxLength={120}
                name="responsibleTitle"
                onChange={(event) => {
                  onTitleChange(event.currentTarget.value);
                }}
                value={title}
              />
            </Field>
          </div>
        </fieldset>
      )}
    </section>
  );
}

function CourseGeneralSettingsFields({
  course,
  effectiveMaxInstallmentCount,
  isFreeCourse,
  isPaidPriceValid,
  isPending,
  maxInstallmentsAllowedByPrice,
  onCoverUploadingChange,
  onPaymentAllowCreditCardChange,
  onPaymentAllowPixChange,
  onPaymentMaxInstallmentCountChange,
  onPriceChange,
  onPricingModeChange,
  onWorkloadHoursOverrideChange,
  paymentAllowCreditCard,
  paymentAllowPix,
  paymentMaxInstallmentCount,
  pricingMode,
  pricingModeError,
  priceError,
  priceValue,
  validInstallmentCount,
  workloadHoursOverride,
  manualWorkloadHours,
}: {
  course: CourseData;
  effectiveMaxInstallmentCount: number;
  isFreeCourse: boolean;
  isPaidPriceValid: boolean;
  isPending: boolean;
  manualWorkloadHours: number | null;
  maxInstallmentsAllowedByPrice: number;
  onCoverUploadingChange: (isUploading: boolean) => void;
  onPaymentAllowCreditCardChange: (enabled: boolean) => void;
  onPaymentAllowPixChange: (enabled: boolean) => void;
  onPaymentMaxInstallmentCountChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onPricingModeChange: (value: CoursePricingMode) => void;
  onWorkloadHoursOverrideChange: (value: number | null) => void;
  paymentAllowCreditCard: boolean;
  paymentAllowPix: boolean;
  paymentMaxInstallmentCount: string;
  pricingMode: CoursePricingMode;
  pricingModeError?: string | undefined;
  priceError?: string | undefined;
  priceValue: string;
  validInstallmentCount: number;
  workloadHoursOverride: string;
}): React.JSX.Element {
  return (
    <>
      <input
        name="workloadHoursOverride"
        type="hidden"
        value={workloadHoursOverride}
      />
      <div className="flex flex-col gap-8">
        <section className="space-y-5">
          <h3 className="font-medium text-base">Identidade do curso</h3>
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-center">
            <Field>
              <CourseCoverUploadField
                aggregateId={course.id}
                className="sm:w-[320px]"
                defaultCoverImage={course.coverImage}
                defaultThumbnailUrl={course.thumbnailUrl}
                onUploadingChange={onCoverUploadingChange}
              />
            </Field>
            <div className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="course-settings-title">Título</FieldLabel>
                <Input
                  defaultValue={course.title}
                  id="course-settings-title"
                  name="title"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="course-settings-description">
                  Descrição
                </FieldLabel>
                <Textarea
                  className="min-h-18 resize-y"
                  defaultValue={course.description ?? ""}
                  id="course-settings-description"
                  name="description"
                />
              </Field>
            </div>
          </div>
        </section>

        <Separator />

        <section className="space-y-5">
          <h3 className="font-medium text-base">Acesso e carga horária</h3>
          <div className="grid max-w-2xl gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="course-settings-workload">
                Carga horária
              </FieldLabel>
              <CourseWorkloadDialog
                calculatedHours={
                  course.calculatedWorkloadHours ?? course.workloadHours
                }
                compact
                onValueChange={onWorkloadHoursOverrideChange}
                triggerId="course-settings-workload"
                value={manualWorkloadHours}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="course-settings-access-duration">
                Meses de acesso
              </FieldLabel>
              <Input
                defaultValue={course.accessDurationMonths ?? 12}
                id="course-settings-access-duration"
                min={1}
                name="accessDurationMonths"
                type="number"
              />
            </Field>
          </div>
        </section>

        <Separator />

        <section className="space-y-5">
          <h3 className="font-medium text-base">Oferta de pagamento</h3>
          <input name="paymentOfferPresent" type="hidden" value="on" />
          <input name="pricingMode" type="hidden" value={pricingMode} />
          <CoursePricingModeField
            error={pricingModeError}
            idPrefix="course-settings-pricing-mode"
            onValueChange={onPricingModeChange}
            value={pricingMode}
          />
          {isFreeCourse ? (
            <>
              <input
                name="price"
                type="hidden"
                value={formatCurrencyInCents(0)}
              />
              <p className="max-w-2xl text-muted-foreground text-sm">
                Curso gratuito. A inscrição é feita diretamente pelo Hub.
              </p>
            </>
          ) : (
            <>
              <Field className="max-w-sm" data-invalid={Boolean(priceError)}>
                <FieldLabel htmlFor="course-settings-price">
                  Valor do curso
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                  <span className="sr-only"> obrigatório</span>
                </FieldLabel>
                <CoursePriceInput
                  ariaDescribedBy={`course-settings-price-description${priceError ? " course-settings-price-error" : ""}`}
                  ariaInvalid={Boolean(priceError)}
                  id="course-settings-price"
                  onValueChange={onPriceChange}
                  value={priceValue}
                />
                <FieldDescription id="course-settings-price-description">
                  Mínimo para Curso pago: R$ 10,00. O valor é formatado em reais
                  ao sair do campo.
                </FieldDescription>
                {priceError ? (
                  <FieldError id="course-settings-price-error">
                    {priceError}
                  </FieldError>
                ) : null}
              </Field>
              {isPaidPriceValid ? (
                <CoursePaidPaymentFields
                  effectiveMaxInstallmentCount={effectiveMaxInstallmentCount}
                  isPending={isPending}
                  maxInstallmentsAllowedByPrice={maxInstallmentsAllowedByPrice}
                  onPaymentAllowCreditCardChange={
                    onPaymentAllowCreditCardChange
                  }
                  onPaymentAllowPixChange={onPaymentAllowPixChange}
                  onPaymentMaxInstallmentCountChange={
                    onPaymentMaxInstallmentCountChange
                  }
                  paymentAllowCreditCard={paymentAllowCreditCard}
                  paymentAllowPix={paymentAllowPix}
                  paymentMaxInstallmentCount={paymentMaxInstallmentCount}
                  validInstallmentCount={validInstallmentCount}
                />
              ) : null}
            </>
          )}
        </section>
      </div>
    </>
  );
}

function CoursePaidPaymentFields({
  effectiveMaxInstallmentCount,
  isPending,
  maxInstallmentsAllowedByPrice,
  onPaymentAllowCreditCardChange,
  onPaymentAllowPixChange,
  onPaymentMaxInstallmentCountChange,
  paymentAllowCreditCard,
  paymentAllowPix,
  paymentMaxInstallmentCount,
  validInstallmentCount,
}: {
  effectiveMaxInstallmentCount: number;
  isPending: boolean;
  maxInstallmentsAllowedByPrice: number;
  onPaymentAllowCreditCardChange: (enabled: boolean) => void;
  onPaymentAllowPixChange: (enabled: boolean) => void;
  onPaymentMaxInstallmentCountChange: (value: string) => void;
  paymentAllowCreditCard: boolean;
  paymentAllowPix: boolean;
  paymentMaxInstallmentCount: string;
  validInstallmentCount: number;
}): React.JSX.Element {
  return (
    <>
      <FieldSet className="max-w-2xl gap-3">
        <FieldLegend variant="label">Formas de pagamento</FieldLegend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field orientation="horizontal">
            <Checkbox
              checked={paymentAllowPix}
              disabled={isPending}
              id="course-payment-pix"
              name="paymentAllowPix"
              onCheckedChange={(checked) => {
                if (checked === false && !paymentAllowCreditCard) {
                  return;
                }
                onPaymentAllowPixChange(checked === true);
              }}
            />
            <FieldLabel htmlFor="course-payment-pix">Aceitar Pix</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              checked={paymentAllowCreditCard}
              disabled={isPending}
              id="course-payment-card"
              name="paymentAllowCreditCard"
              onCheckedChange={(checked) => {
                if (checked === false && !paymentAllowPix) {
                  return;
                }
                onPaymentAllowCreditCardChange(checked === true);
              }}
            />
            <FieldLabel htmlFor="course-payment-card">
              Aceitar cartão
            </FieldLabel>
          </Field>
        </div>
      </FieldSet>
      <Field className="max-w-sm">
        <FieldLabel htmlFor="course-payment-installments">
          Máximo de parcelas
        </FieldLabel>
        <Select
          disabled={!paymentAllowCreditCard || isPending}
          name="paymentMaxInstallmentCount"
          onValueChange={onPaymentMaxInstallmentCountChange}
          required={paymentAllowCreditCard}
          value={paymentMaxInstallmentCount}
        >
          <SelectTrigger id="course-payment-installments">
            <SelectValue placeholder="Selecione o limite" />
          </SelectTrigger>
          <SelectContent>
            {INSTALLMENT_OPTIONS.map((installmentCount) => (
              <SelectItem
                disabled={installmentCount > maxInstallmentsAllowedByPrice}
                key={installmentCount}
                value={installmentCount.toString()}
              >
                {installmentCount}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          {paymentAllowCreditCard
            ? `O preço atual permite até ${maxInstallmentsAllowedByPrice}x por causa do valor mínimo por parcela.`
            : "Ative o cartão para configurar o limite de parcelas."}
        </FieldDescription>
      </Field>
      <p className="max-w-2xl text-muted-foreground text-sm">
        O Checkout Asaas aplica estas opções somente às novas compras. Taxas e
        recebimento seguem o contrato da conta Asaas.
      </p>
      {paymentAllowCreditCard &&
      effectiveMaxInstallmentCount < validInstallmentCount ? (
        <p className="max-w-2xl text-sm text-warning">
          Pelo preço atual, o Checkout será limitado a{" "}
          {effectiveMaxInstallmentCount}x. A configuração de{" "}
          {validInstallmentCount}x continua salva para futuros reajustes de
          preço.
        </p>
      ) : null}
    </>
  );
}

export function CourseSettingsForm({
  course,
  readOnly = false,
  signatoryReadOnly = readOnly,
  availabilityReadOnly = readOnly,
}: {
  availabilityReadOnly?: boolean;
  course: CourseData;
  readOnly?: boolean;
  signatoryReadOnly?: boolean;
}): React.JSX.Element {
  return readOnly && signatoryReadOnly && availabilityReadOnly ? (
    <CourseSettingsReadOnly course={course} />
  ) : (
    <CourseSettingsEditor
      availabilityReadOnly={availabilityReadOnly}
      course={course}
      readOnly={readOnly}
      signatoryReadOnly={signatoryReadOnly}
    />
  );
}

function CourseSettingsSaveFlags({
  availabilityPreset,
  availabilityReadOnly,
  courseId,
  readOnly,
  signatoryReadOnly,
}: {
  availabilityPreset: ReturnType<typeof getCourseAvailabilityPreset>;
  availabilityReadOnly: boolean;
  courseId: string;
  readOnly: boolean;
  signatoryReadOnly: boolean;
}): React.JSX.Element {
  return (
    <>
      <input name="courseId" type="hidden" value={courseId} />
      {readOnly ? null : (
        <input name="saveCourseDetails" type="hidden" value="on" />
      )}
      {signatoryReadOnly ? null : (
        <input name="saveCourseResponsible" type="hidden" value="on" />
      )}
      {availabilityReadOnly || availabilityPreset === "archived" ? null : (
        <input name="saveCourseAvailability" type="hidden" value="on" />
      )}
    </>
  );
}

function CourseSettingsSaveButton({
  canSaveSettings,
  isCoverUploading,
  isPending,
}: {
  canSaveSettings: boolean;
  isCoverUploading: boolean;
  isPending: boolean;
}): React.JSX.Element | null {
  if (!canSaveSettings) {
    return null;
  }

  return (
    <div className="flex justify-end border-t pt-6">
      <Button loading={isPending || isCoverUploading} type="submit">
        {isPending ? null : (
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={FloppyDiskIcon}
            size={18}
            strokeWidth={2}
          />
        )}
        Salvar configurações
      </Button>
    </div>
  );
}

function CoursePriceChangeDialog({
  currentPriceInCents,
  onCancel,
  onConfirm,
  pendingPriceChange,
}: {
  currentPriceInCents: number;
  onCancel: () => void;
  onConfirm: () => void;
  pendingPriceChange: PendingPriceChange | null;
}): React.JSX.Element | null {
  if (!pendingPriceChange) {
    return null;
  }

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <HugeiconsIcon aria-hidden="true" icon={AlertCircleIcon} />
          </AlertDialogMedia>
          <AlertDialogTitle>Confirmar alteração de preço?</AlertDialogTitle>
          <AlertDialogDescription>
            O preço do Curso será alterado de{" "}
            <span className="font-medium text-foreground">
              {formatCoursePriceChangeLabel(currentPriceInCents)}
            </span>{" "}
            para{" "}
            <span className="font-medium text-foreground">
              {formatCoursePriceChangeLabel(pendingPriceChange.priceInCents)}
            </span>
            . A mudança vale para novas inscrições; Matrículas existentes e
            Pedidos já criados não serão alterados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            Confirmar alteração
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CourseSettingsEditor({
  availabilityReadOnly = false,
  course,
  readOnly = false,
  signatoryReadOnly = false,
}: {
  availabilityReadOnly?: boolean;
  course: CourseData;
  readOnly?: boolean;
  signatoryReadOnly?: boolean;
}): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pricingModeError, setPricingModeError] = useState<string | null>(null);
  const [pendingPriceChange, setPendingPriceChange] =
    useState<PendingPriceChange | null>(null);
  const [pricingMode, setPricingMode] = useState<CoursePricingMode>(
    course.priceInCents === 0 ? "free" : "paid"
  );
  const [priceValue, setPriceValue] = useState(() =>
    course.priceInCents === 0 ? "" : formatCurrencyInCents(course.priceInCents)
  );
  const [workloadHoursOverride, setWorkloadHoursOverride] = useState(
    course.workloadHoursOverride?.toString() ?? ""
  );
  const [paymentAllowPix, setPaymentAllowPix] = useState(
    course.paymentAllowPix
  );
  const [paymentAllowCreditCard, setPaymentAllowCreditCard] = useState(
    course.paymentAllowCreditCard
  );
  const [paymentMaxInstallmentCount, setPaymentMaxInstallmentCount] = useState(
    course.paymentMaxInstallmentCount.toString()
  );
  const [responsibleName, setResponsibleName] = useState(
    course.certificateSignerName ?? ""
  );
  const [responsibleTitle, setResponsibleTitle] = useState(
    course.certificateSignerRole ?? ""
  );
  const [availabilityPreset, setAvailabilityPreset] = useState(() =>
    getCourseAvailabilityPreset(course)
  );
  const [showInCatalog, setShowInCatalog] = useState(
    course.catalogVisibility === "listed"
  );
  const manualWorkloadHours =
    workloadHoursOverride.trim() === "" ? null : Number(workloadHoursOverride);
  const configuredInstallmentCount = Number(paymentMaxInstallmentCount);
  const validInstallmentCount = Number.isFinite(configuredInstallmentCount)
    ? configuredInstallmentCount
    : MIN_INSTALLMENT_COUNT;
  const parsedPriceInCents = (() => {
    try {
      return parseCoursePriceToCents(priceValue);
    } catch {
      return null;
    }
  })();
  const isFreeCourse = pricingMode === "free";
  const isPaidPriceValid =
    parsedPriceInCents !== null && parsedPriceInCents > 0;
  const priceInCentsForInstallments = parsedPriceInCents ?? course.priceInCents;
  const maxInstallmentsAllowedByPrice = getEffectiveMaxInstallmentCount({
    configuredMaxInstallmentCount: MAX_INSTALLMENT_COUNT,
    priceInCents: priceInCentsForInstallments,
  });
  const effectiveMaxInstallmentCount = Math.min(
    validInstallmentCount,
    maxInstallmentsAllowedByPrice
  );
  const canSaveSettings =
    !(readOnly && signatoryReadOnly) ||
    (!availabilityReadOnly && availabilityPreset !== "archived");

  useEffect(() => {
    if (priceError) {
      document.getElementById("course-settings-price")?.focus();
    }
  }, [priceError]);

  const saveCourseSettings = (formData: FormData): void => {
    if (isCoverUploading) {
      return;
    }
    setErrorMessage(null);
    const toastId = toast.loading("Salvando configurações…");

    startTransition(async () => {
      try {
        const result = await saveCourseSettingsAction(formData);
        if (!result.ok) {
          throw new Error(result.message);
        }
        setIsDirty(false);
        toast.success(
          getCourseSettingsSuccessMessage(
            result,
            formData.get("saveCourseAvailability") === "on"
          ),
          { id: toastId }
        );
      } catch (error) {
        const failure = getCourseSettingsFailure(error);
        applyCourseSettingsFailure(
          failure,
          setErrorMessage,
          setPriceError,
          setPricingModeError
        );
        toast.error(failure.message, { id: toastId });
      }
    });
  };
  useCourseTabDirty("settings", isDirty);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (isCoverUploading) {
      return;
    }
    const formData = new FormData(e.currentTarget);

    submitCourseSettings({
      currentPriceInCents: course.priceInCents,
      formData,
      onInvalidPrice: () => {
        setPriceError(COURSE_PRICE_FIELD_ERROR_MESSAGE);
        setPricingModeError(null);
      },
      onInvalidPricingMode: () => {
        setPricingModeError(COURSE_PRICING_MODE_ERROR_MESSAGE);
        setPriceError(null);
        document.getElementById("course-settings-pricing-mode-free")?.focus();
      },
      onPriceChange: (submittedFormData, priceInCents) => {
        setPriceError(null);
        setPricingModeError(null);
        setPendingPriceChange({ formData: submittedFormData, priceInCents });
      },
      readOnly,
      save: saveCourseSettings,
    });
  };

  const confirmPendingPriceChange = (): void => {
    const priceChange = pendingPriceChange;
    setPendingPriceChange(null);
    if (priceChange) {
      saveCourseSettings(priceChange.formData);
    }
  };

  return (
    <>
      <form
        className="flex flex-col gap-8"
        onChange={() => {
          setIsDirty(true);
        }}
        onSubmit={handleSubmit}
      >
        {errorMessage ? (
          <Alert role="alert" variant="destructive">
            <AlertTitle>Não foi possível salvar o curso</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <CourseSettingsSaveFlags
          availabilityPreset={availabilityPreset}
          availabilityReadOnly={availabilityReadOnly}
          courseId={course.id}
          readOnly={readOnly}
          signatoryReadOnly={signatoryReadOnly}
        />

        {readOnly ? (
          <CourseSettingsReadOnly
            course={course}
            includeAvailability={false}
            includeResponsible={false}
          />
        ) : (
          <fieldset className="contents" disabled={isPending}>
            <CourseGeneralSettingsFields
              course={course}
              effectiveMaxInstallmentCount={effectiveMaxInstallmentCount}
              isFreeCourse={isFreeCourse}
              isPaidPriceValid={isPaidPriceValid}
              isPending={isPending}
              manualWorkloadHours={manualWorkloadHours}
              maxInstallmentsAllowedByPrice={maxInstallmentsAllowedByPrice}
              onCoverUploadingChange={setIsCoverUploading}
              onPaymentAllowCreditCardChange={setPaymentAllowCreditCard}
              onPaymentAllowPixChange={setPaymentAllowPix}
              onPaymentMaxInstallmentCountChange={setPaymentMaxInstallmentCount}
              onPriceChange={(value) => {
                setPriceValue(value);
                setPriceError(null);
              }}
              onPricingModeChange={(value) => {
                setPricingMode(value);
                setPriceError(null);
                setPricingModeError(null);
                setIsDirty(true);
              }}
              onWorkloadHoursOverrideChange={(value) => {
                setWorkloadHoursOverride(value?.toString() ?? "");
              }}
              paymentAllowCreditCard={paymentAllowCreditCard}
              paymentAllowPix={paymentAllowPix}
              paymentMaxInstallmentCount={paymentMaxInstallmentCount}
              priceError={priceError ?? undefined}
              priceValue={priceValue}
              pricingMode={pricingMode}
              pricingModeError={pricingModeError ?? undefined}
              validInstallmentCount={validInstallmentCount}
              workloadHoursOverride={workloadHoursOverride}
            />
          </fieldset>
        )}

        <Separator />

        <CourseResponsibleFields
          course={course}
          disabled={isPending}
          name={responsibleName}
          onNameChange={setResponsibleName}
          onTitleChange={setResponsibleTitle}
          readOnly={signatoryReadOnly}
          title={responsibleTitle}
        />

        <Separator />

        <section className="space-y-5">
          <div className="space-y-1">
            <h3 className="font-medium text-base">Disponibilidade</h3>
            <p className="text-muted-foreground text-sm">
              Controle a vitrine e novas vendas. Matrículas existentes não são
              alteradas.
            </p>
          </div>
          <CourseAvailabilityFields
            course={course}
            disabled={isPending}
            onPresetChange={(value) => {
              setAvailabilityPreset(value);
              setIsDirty(true);
            }}
            onShowInCatalogChange={(value) => {
              setShowInCatalog(value);
              setIsDirty(true);
            }}
            preset={availabilityPreset}
            readOnly={availabilityReadOnly}
            showInCatalog={showInCatalog}
          />
        </section>

        <CourseSettingsSaveButton
          canSaveSettings={canSaveSettings}
          isCoverUploading={isCoverUploading}
          isPending={isPending}
        />
      </form>

      <CoursePriceChangeDialog
        currentPriceInCents={course.priceInCents}
        onCancel={() => setPendingPriceChange(null)}
        onConfirm={confirmPendingPriceChange}
        pendingPriceChange={pendingPriceChange}
      />
    </>
  );
}
