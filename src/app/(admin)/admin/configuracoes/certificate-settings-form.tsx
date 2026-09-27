"use client";

import {
  FloppyDiskIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import {
  AdminMutationForm,
  AdminMutationSubmitButton,
  useAdminMutationFormState,
} from "@/components/admin-mutation-form";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { saveSettingsAction } from "@/features/admin/actions";
import { formatCnpjInput } from "@/lib/cnpj";

export interface CertificateSettingsFormValues {
  issuerCnpj: string | null;
  issuerDisplayName: string | null;
  issuerLegalName: string | null;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Não foi possível salvar.";

const getSettingsFieldErrors = (error: unknown): Record<string, string> => {
  const message = getErrorMessage(error);
  if (message.includes("razão social e CNPJ")) {
    return {
      issuerCnpj: message,
      issuerLegalName: message,
    };
  }
  if (message.includes("CNPJ válido")) {
    return { issuerCnpj: message };
  }
  return {};
};

function FieldHelp({
  children,
  label,
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

function CertificateSettingsFields({
  readOnly,
  settings,
}: {
  readOnly: boolean;
  settings: CertificateSettingsFormValues;
}): React.JSX.Element {
  const { fieldErrors } = useAdminMutationFormState();
  const [cnpj, setCnpj] = useState(() =>
    formatCnpjInput(settings.issuerCnpj ?? "")
  );
  const legalNameError = fieldErrors.issuerLegalName;
  const cnpjError = fieldErrors.issuerCnpj;

  return (
    <TooltipProvider delayDuration={250}>
      <FieldGroup>
        <FieldSet className="gap-4">
          <FieldLegend variant="label">Instituição emissora</FieldLegend>
          <FieldDescription>
            Razão social e CNPJ são obrigatórios juntos para manter o perfil
            pronto para novas emissões.
          </FieldDescription>
          <div className="grid gap-5 md:grid-cols-2">
            <Field data-invalid={Boolean(legalNameError)}>
              <div className="flex min-h-6 items-center gap-1.5">
                <FieldLabel htmlFor="issuer-legal-name">
                  Razão social
                </FieldLabel>
              </div>
              <Input
                aria-describedby={
                  legalNameError ? "issuer-legal-name-error" : undefined
                }
                aria-invalid={legalNameError ? true : undefined}
                autoComplete="organization"
                defaultValue={settings.issuerLegalName ?? ""}
                disabled={readOnly}
                id="issuer-legal-name"
                name="issuerLegalName"
                required
              />
              {legalNameError ? (
                <FieldError id="issuer-legal-name-error">
                  {legalNameError}
                </FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(cnpjError)}>
              <div className="flex min-h-6 items-center gap-1.5">
                <FieldLabel htmlFor="issuer-cnpj">CNPJ</FieldLabel>
                <FieldHelp label="Ajuda sobre o CNPJ">
                  Informe os 14 dígitos em pontuação.
                </FieldHelp>
              </div>
              <Input
                aria-describedby={cnpjError ? "issuer-cnpj-error" : undefined}
                aria-invalid={cnpjError ? true : undefined}
                autoComplete="organization"
                disabled={readOnly}
                id="issuer-cnpj"
                inputMode="numeric"
                maxLength={18}
                name="issuerCnpj"
                onChange={(event) =>
                  setCnpj(formatCnpjInput(event.target.value))
                }
                placeholder="00.000.000/0000-00"
                required
                value={cnpj}
              />
              {cnpjError ? (
                <FieldError id="issuer-cnpj-error">{cnpjError}</FieldError>
              ) : null}
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="issuer-display-name">
                Marca exibida
              </FieldLabel>
              <Input
                autoComplete="organization"
                defaultValue={settings.issuerDisplayName ?? ""}
                disabled={readOnly}
                id="issuer-display-name"
                name="issuerDisplayName"
              />
            </Field>
          </div>
        </FieldSet>

        <AdminMutationSubmitButton
          className="w-full sm:w-fit"
          disabled={readOnly}
          type="submit"
        >
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={FloppyDiskIcon}
            size={18}
            strokeWidth={2}
          />
          Salvar configurações
        </AdminMutationSubmitButton>
      </FieldGroup>
    </TooltipProvider>
  );
}

export function CertificateSettingsForm({
  readOnly = false,
  settings,
}: {
  readOnly?: boolean;
  settings: CertificateSettingsFormValues;
}): React.JSX.Element {
  return (
    <AdminMutationForm
      action={saveSettingsAction}
      getFieldErrors={getSettingsFieldErrors}
    >
      <fieldset>
        <CertificateSettingsFields readOnly={readOnly} settings={settings} />
      </fieldset>
    </AdminMutationForm>
  );
}
