"use client";

import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useId } from "react";
import {
  AdminMutationForm,
  AdminMutationSubmitButton,
} from "@/components/admin-mutation-form";
import { IconCircleCheck } from "@/components/custom icons/icon-circle-check";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ActiveEmailChangeSummary } from "@/features/account/email-change";
import {
  cancelAccountEmailChangeAction,
  requestAccountEmailChangeAction,
  requestAccountEmailVerificationAction,
} from "@/features/account/profile-actions";

function VerifyEmailAction(): React.JSX.Element {
  return (
    <AdminMutationForm
      action={requestAccountEmailVerificationAction}
      pendingMessage="Enviando confirmação…"
      successMessage="Confira seu e-mail para confirmar o endereço."
    >
      <AdminMutationSubmitButton type="submit" variant="outline">
        Confirmar e-mail
      </AdminMutationSubmitButton>
    </AdminMutationForm>
  );
}

function CancelEmailChangeAction(): React.JSX.Element {
  return (
    <AdminMutationForm
      action={cancelAccountEmailChangeAction}
      pendingMessage="Cancelando…"
      successMessage="Alteração cancelada."
    >
      <AdminMutationSubmitButton size="sm" type="submit" variant="outline">
        Cancelar
      </AdminMutationSubmitButton>
    </AdminMutationForm>
  );
}

function EmailChangeDialog({
  triggerLabel,
}: {
  triggerLabel: string;
}): React.JSX.Element {
  const emailId = useId();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar e-mail</DialogTitle>
          <DialogDescription>
            Confirme o endereço atual e o novo para concluir a troca.
          </DialogDescription>
        </DialogHeader>
        <AdminMutationForm
          action={requestAccountEmailChangeAction}
          className="grid gap-5 p-6"
          closeOnSuccess
          pendingMessage="Enviando solicitação…"
          successMessage="Solicitação enviada. Confira seu e-mail."
        >
          <Field className="gap-2">
            <FieldLabel htmlFor={emailId}>Novo e-mail</FieldLabel>
            <Input
              autoComplete="email"
              id={emailId}
              maxLength={254}
              name="newEmail"
              required
              type="email"
            />
            <FieldDescription>
              O e-mail atual continua ativo até a confirmação.
            </FieldDescription>
          </Field>
          <DialogFooter className="-mx-6 -mb-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <AdminMutationSubmitButton type="submit">
              Continuar
            </AdminMutationSubmitButton>
          </DialogFooter>
        </AdminMutationForm>
      </DialogContent>
    </Dialog>
  );
}

const getPendingEmailText = (
  pendingEmailChange: ActiveEmailChangeSummary
): string => {
  if (pendingEmailChange.status === "expired") {
    return "O prazo terminou. Você pode iniciar uma nova alteração.";
  }
  if (pendingEmailChange.status === "pending_current") {
    return "Confirme o link enviado para seu e-mail atual.";
  }
  return `Confirme o link enviado para ${pendingEmailChange.newEmail}.`;
};

export function AccountEmailPanel({
  currentEmail,
  emailVerified,
  pendingEmailChange,
}: {
  currentEmail: string;
  emailVerified: boolean;
  pendingEmailChange: ActiveEmailChangeSummary | null;
}): React.JSX.Element {
  const canStartEmailChange =
    emailVerified &&
    (!pendingEmailChange || pendingEmailChange.status === "expired");

  return (
    <div className="grid gap-6">
      <Field className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="account-current-email">E-mail</FieldLabel>
          {emailVerified ? null : (
            <Badge className="shrink-0" variant="warning">
              Não confirmado
            </Badge>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <InputGroup className="min-w-0 flex-1">
            <InputGroupInput
              className="truncate"
              id="account-current-email"
              readOnly
              value={currentEmail}
            />
            <InputGroupAddon align="inline-start">
              <HugeiconsIcon aria-hidden="true" icon={Mail01Icon} size={16} />
            </InputGroupAddon>
            {emailVerified ? (
              <InputGroupAddon align="inline-end" className="py-0">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InputGroupButton
                        aria-label="E-mail confirmado"
                        size="icon-xs"
                        type="button"
                        variant="ghost"
                      >
                        <IconCircleCheck className="size-4 text-learning-complete" />
                      </InputGroupButton>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                      Confirmado
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          {canStartEmailChange ? (
            <EmailChangeDialog
              triggerLabel={
                pendingEmailChange?.status === "expired"
                  ? "Tentar novamente"
                  : "Alterar"
              }
            />
          ) : null}
        </div>
      </Field>

      {emailVerified ? null : (
        <Alert variant="warning">
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>Confirme este endereço para entrar com e-mail.</span>
            <VerifyEmailAction />
          </AlertDescription>
        </Alert>
      )}

      {pendingEmailChange ? (
        <div className="flex flex-col gap-3 rounded-surface border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              {pendingEmailChange.status === "expired"
                ? "Alteração expirada"
                : "Confirmação pendente"}
            </p>
            <p className="text-muted-foreground text-sm">
              {getPendingEmailText(pendingEmailChange)}
            </p>
          </div>
          <CancelEmailChangeAction />
        </div>
      ) : null}
    </div>
  );
}
