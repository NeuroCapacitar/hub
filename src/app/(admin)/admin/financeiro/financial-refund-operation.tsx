"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmRefundPasswordAction,
  requestFullRefundAction,
} from "@/features/payments/actions";
import { authClient } from "@/lib/auth-client";
import { route } from "@/lib/routes";
import {
  BUYER_IDENTITY_REVIEW_NO_ACCESS_MESSAGE,
  getErrorMessage,
  REFUND_ASAAS_CONFIRMATION_MESSAGE,
} from "./financial-operations-shared";

type PasswordCredentialStatus =
  | "unchecked"
  | "checking"
  | "available"
  | "missing"
  | "unavailable";

function RefundPasswordCredentialGate({
  children,
  onRetry,
  status,
}: {
  children: ReactNode;
  onRetry: () => Promise<void>;
  status: PasswordCredentialStatus;
}): ReactNode {
  if (status === "checking") {
    return (
      <p
        aria-live="polite"
        className="mt-3 text-muted-foreground text-sm"
        role="status"
      >
        Verificando o método de acesso…
      </p>
    );
  }

  if (status === "missing") {
    return (
      <div className="mt-3 grid gap-3">
        <p className="text-sm">
          Sua conta ainda não tem uma senha local. Defina-a pelo e-mail; depois,
          volte aqui e confirme para continuar com o reembolso.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline">
            <Link
              href={route("/recuperar-senha")}
              rel="noopener noreferrer"
              target="_blank"
            >
              Definir senha por e-mail
            </Link>
          </Button>
          <Button onClick={onRetry} type="button" variant="ghost">
            Já defini a senha
          </Button>
        </div>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="mt-3 grid gap-3">
        <p className="text-muted-foreground text-sm">
          Não foi possível verificar o método de acesso. Tente novamente para
          continuar com segurança.
        </p>
        <Button
          className="w-fit"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return children;
}

export function RefundOperation({
  identityReview = false,
  orderId,
}: {
  identityReview?: boolean;
  orderId: string;
}): React.JSX.Element {
  const router = useRouter();
  const confirmationInputRef = useRef<HTMLInputElement>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [credentialStatus, setCredentialStatus] =
    useState<PasswordCredentialStatus>("unchecked");

  const checkPasswordCredential = async (): Promise<void> => {
    setCredentialStatus("checking");
    try {
      const result = await authClient.listAccounts();
      if (result.error || !result.data) {
        setCredentialStatus("unavailable");
        return;
      }

      setCredentialStatus(
        result.data.some((account) => account.providerId === "credential")
          ? "available"
          : "missing"
      );
    } catch {
      setCredentialStatus("unavailable");
    }
  };

  const handleDisclosureToggle = async (
    event: React.SyntheticEvent<HTMLDetailsElement>
  ): Promise<void> => {
    if (event.currentTarget.open && credentialStatus === "unchecked") {
      await checkPasswordCredential();
    }
  };

  useEffect(() => {
    if (confirmationToken) {
      confirmationInputRef.current?.focus();
    }
  }, [confirmationToken]);

  const confirmPassword = async (formData: FormData): Promise<void> => {
    setError(null);
    setSuccessMessage(null);
    setPending(true);
    try {
      const result = await confirmRefundPasswordAction(formData);
      setConfirmationToken(result.confirmationToken);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  const requestRefund = async (formData: FormData): Promise<void> => {
    setError(null);
    setSuccessMessage(null);
    setPending(true);
    try {
      await requestFullRefundAction(formData);
      setConfirmationToken(null);
      setSuccessMessage(
        `Solicitação de reembolso registrada. ${REFUND_ASAAS_CONFIRMATION_MESSAGE}`
      );
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <details
      className="mt-3 rounded-detail border bg-background p-3"
      onToggle={handleDisclosureToggle}
    >
      <summary className="cursor-pointer rounded-detail font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        Solicitar reembolso integral
      </summary>
      {confirmationToken ? (
        <>
          <p aria-live="polite" className="mt-2 text-sm" role="status">
            Senha confirmada. A etapa 2 de 2 está pronta para preenchimento.
          </p>
          <form
            action={requestRefund}
            aria-describedby={`refund-step-two-description-${orderId}`}
            aria-labelledby={`refund-step-two-${orderId}`}
            className="mt-3"
          >
            <h4
              className="font-medium text-sm"
              id={`refund-step-two-${orderId}`}
            >
              Etapa 2 de 2: confirmar a solicitação
            </h4>
            <p
              className="mt-2 text-muted-foreground text-xs"
              id={`refund-step-two-description-${orderId}`}
            >
              {identityReview
                ? `Confirme o ID do Pedido e informe o motivo. ${BUYER_IDENTITY_REVIEW_NO_ACCESS_MESSAGE}`
                : `Confirme o ID do Pedido e informe o motivo. ${REFUND_ASAAS_CONFIRMATION_MESSAGE}`}
            </p>
            <input
              name="confirmationToken"
              type="hidden"
              value={confirmationToken}
            />
            <input name="orderId" type="hidden" value={orderId} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`refund-order-${orderId}`}>
                  ID do Pedido
                </FieldLabel>
                <Input
                  autoComplete="off"
                  className="font-mono text-xs"
                  id={`refund-order-${orderId}`}
                  name="typedOrderId"
                  placeholder="Cole o ID completo…"
                  ref={confirmationInputRef}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`refund-reason-${orderId}`}>
                  Motivo da solicitação
                </FieldLabel>
                <Textarea
                  id={`refund-reason-${orderId}`}
                  name="reason"
                  required
                />
              </Field>
            </FieldGroup>
            <Button
              className="mt-3 w-full sm:w-auto"
              loading={pending}
              type="submit"
              variant="destructive"
            >
              Confirmar solicitação de reembolso
            </Button>
          </form>
        </>
      ) : (
        <RefundPasswordCredentialGate
          onRetry={checkPasswordCredential}
          status={credentialStatus}
        >
          <form
            action={confirmPassword}
            aria-describedby={`refund-step-one-description-${orderId}`}
            aria-labelledby={`refund-step-one-${orderId}`}
            className="mt-3"
          >
            <h4
              className="font-medium text-sm"
              id={`refund-step-one-${orderId}`}
            >
              Etapa 1 de 2: confirmar a senha
            </h4>
            <p
              className="mt-2 text-muted-foreground text-xs"
              id={`refund-step-one-description-${orderId}`}
            >
              {identityReview
                ? `Confirme sua senha atual para autorizar a solicitação. ${BUYER_IDENTITY_REVIEW_NO_ACCESS_MESSAGE}`
                : "Confirme sua senha atual para autorizar a solicitação de reembolso."}
            </p>
            <input name="orderId" type="hidden" value={orderId} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`refund-password-${orderId}`}>
                  Sua senha atual
                </FieldLabel>
                <PasswordInput
                  autoComplete="current-password"
                  id={`refund-password-${orderId}`}
                  name="password"
                  required
                  type="password"
                />
              </Field>
            </FieldGroup>
            <Button
              className="mt-3 w-full sm:w-auto"
              loading={pending}
              type="submit"
              variant="outline"
            >
              Confirmar senha
            </Button>
          </form>
        </RefundPasswordCredentialGate>
      )}
      {error ? (
        <p
          aria-live="assertive"
          className="mt-2 text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p
          aria-live="polite"
          className="mt-2 text-sm text-success"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
    </details>
  );
}
