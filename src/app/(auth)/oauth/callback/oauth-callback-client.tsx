"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  getAuthSignInPath,
  getSafeAuthRedirectPath,
  getSafeAuthReturnTo,
} from "@/lib/auth-return-to";

type CallbackState = "blocked" | "failed" | "loading";
type VerificationRequestState = "idle" | "sent" | "unavailable";

const getAuthRedirectPath = (returnTo: string | null): string => {
  const safeReturnTo = getSafeAuthReturnTo(returnTo);
  if (!safeReturnTo) {
    return "/api/auth/redirect";
  }

  return `/api/auth/redirect?${new URLSearchParams({ returnTo: safeReturnTo }).toString()}`;
};

const getRedirectPath = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return getSafeAuthRedirectPath(Reflect.get(value, "redirectTo"));
};

type CallbackResolution =
  | { state: "blocked" }
  | { state: "failed" }
  | { destination: string; state: "redirect" };

const resolveOAuthCallback = async (
  returnTo: string | null
): Promise<CallbackResolution> => {
  try {
    const response = await fetch(getAuthRedirectPath(returnTo), {
      credentials: "same-origin",
      headers: { "ngrok-skip-browser-warning": "true" },
    });

    if (response.status === 403) {
      await fetch("/api/auth/sign-out", { method: "POST" }).catch(
        () => undefined
      );
      return { state: "blocked" };
    }

    if (!response.ok) {
      return { state: "failed" };
    }

    const destination = getRedirectPath(await response.json());
    return destination
      ? { destination, state: "redirect" }
      : { state: "failed" };
  } catch {
    return { state: "failed" };
  }
};

export function GoogleOAuthCallbackClient({
  hasProviderError,
  returnTo,
  supportEmail,
  verificationCallbackUrl,
}: {
  hasProviderError: boolean;
  returnTo: string | null;
  supportEmail: string | null;
  verificationCallbackUrl: string;
}): React.JSX.Element {
  const [callbackState, setCallbackState] = useState<CallbackState>(
    hasProviderError ? "failed" : "loading"
  );
  const [showVerificationForm, setShowVerificationForm] = useState(false);
  const [verificationRequestState, setVerificationRequestState] =
    useState<VerificationRequestState>("idle");
  const [isVerificationPending, setIsVerificationPending] = useState(false);

  useEffect(() => {
    if (hasProviderError) {
      return;
    }

    let isCurrent = true;
    const completeCallback = async (): Promise<void> => {
      const result = await resolveOAuthCallback(returnTo);
      if (!isCurrent) {
        return;
      }

      if (result.state === "redirect") {
        window.location.replace(result.destination);
        return;
      }

      setCallbackState(result.state);
    };

    completeCallback().catch(() => {
      if (isCurrent) {
        setCallbackState("failed");
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [hasProviderError, returnTo]);

  const handleVerificationRequest = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    setIsVerificationPending(true);
    setVerificationRequestState("idle");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    try {
      await authClient.sendVerificationEmail({
        callbackURL: verificationCallbackUrl,
        email,
      });
      setVerificationRequestState("sent");
    } catch {
      setVerificationRequestState("unavailable");
    } finally {
      setIsVerificationPending(false);
    }
  };

  if (callbackState === "loading") {
    return (
      <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-6">
          <CardTitle as="h1" className="type-page-title">
            Concluindo seu acesso
          </CardTitle>
          <CardDescription>
            Estamos confirmando sua sessão para levar você ao lugar certo.
          </CardDescription>
        </CardHeader>
        <CardContent
          aria-live="polite"
          className="px-0 text-muted-foreground text-sm"
        >
          Aguarde um instante…
        </CardContent>
      </Card>
    );
  }

  if (callbackState === "blocked") {
    return (
      <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-5">
          <CardTitle as="h1" className="type-page-title">
            Acesso bloqueado
          </CardTitle>
          <CardDescription>
            Sua conta não pode acessar a plataforma no momento. O login foi
            encerrado; fale com o suporte para revisar o acesso.
          </CardDescription>
        </CardHeader>
        {supportEmail ? (
          <CardContent className="px-0">
            <Button asChild className="w-full" variant="outline">
              <a
                href={`mailto:${supportEmail}?subject=${encodeURIComponent("Acesso bloqueado na conta")}`}
              >
                Falar com o suporte
              </a>
            </Button>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
      <CardHeader className="gap-2 px-0 pb-5">
        <CardTitle as="h1" className="type-page-title">
          Não foi possível entrar com Google
        </CardTitle>
        <CardDescription>
          Confira se você usou o e-mail da sua conta. Se ela foi criada após uma
          compra e ainda precisa de confirmação, podemos enviar um link para
          você.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Alert aria-live="polite" variant="destructive">
          <AlertDescription>
            Não foi possível concluir a entrada com Google.
          </AlertDescription>
        </Alert>
        <Button
          className="mt-5 w-full"
          onClick={() => {
            setShowVerificationForm((isVisible) => !isVisible);
            setVerificationRequestState("idle");
          }}
          type="button"
          variant="outline"
        >
          {showVerificationForm
            ? "Fechar confirmação por e-mail"
            : "Enviar link de confirmação"}
        </Button>
        {showVerificationForm ? (
          <form className="mt-5" onSubmit={handleVerificationRequest}>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="verification-email">
                  E-mail da conta
                </FieldLabel>
                <Input
                  autoComplete="email"
                  className="h-11"
                  id="verification-email"
                  name="email"
                  placeholder="aluno@exemplo.com"
                  required
                  type="email"
                />
              </Field>
            </FieldGroup>
            <Button
              className="mt-4 w-full"
              loading={isVerificationPending}
              type="submit"
            >
              Enviar link
            </Button>
            {verificationRequestState === "sent" ? (
              <p
                aria-live="polite"
                className="mt-4 text-muted-foreground text-sm"
              >
                Se este e-mail corresponder a uma conta que precisa de
                confirmação, enviaremos um link.
              </p>
            ) : null}
            {verificationRequestState === "unavailable" ? (
              <p aria-live="polite" className="mt-4 text-destructive text-sm">
                Não foi possível processar a solicitação agora. Tente novamente.
              </p>
            ) : null}
          </form>
        ) : null}
        <Link
          className="mt-5 inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          href={getAuthSignInPath(returnTo)}
        >
          Voltar para entrar
        </Link>
      </CardContent>
    </Card>
  );
}
