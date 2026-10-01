"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { getSafeAuthReturnTo } from "@/lib/auth-return-to";
import { route } from "@/lib/routes";
import { getSignInOutcome } from "./sign-in-result";

const getAuthRedirectPath = (returnTo: string | null): string => {
  const searchParams = new URLSearchParams();
  if (returnTo) {
    searchParams.set("returnTo", returnTo);
  }
  const query = searchParams.toString();
  return query ? `/api/auth/redirect?${query}` : "/api/auth/redirect";
};

export function SignInForm({
  emailVerificationFailed = false,
  emailVerified = false,
  googleLoginEnabled = false,
  googleOAuthCallbackUrl,
  returnTo = null,
  supportEmail = null,
}: {
  emailVerificationFailed?: boolean;
  emailVerified?: boolean;
  googleLoginEnabled?: boolean;
  googleOAuthCallbackUrl?: string;
  returnTo?: string | null;
  supportEmail?: string | null;
} = {}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isAccessBlocked, setIsAccessBlocked] = useState(false);
  const [isEmailVerificationRequired, setIsEmailVerificationRequired] =
    useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isVerificationRequestPending, setIsVerificationRequestPending] =
    useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(
    null
  );
  const [verificationEmail, setVerificationEmail] = useState("");
  const safeReturnTo = getSafeAuthReturnTo(returnTo);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsAccessBlocked(false);
    setIsEmailVerificationRequired(false);
    setVerificationNotice(null);
    setIsPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "").trim();
      const response = await fetch("/api/auth/sign-in/email", {
        body: JSON.stringify({
          email,
          password: formData.get("password"),
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        method: "POST",
      });

      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      const signInOutcome = getSignInOutcome(payload);

      if (signInOutcome === "email_verification_required") {
        setVerificationEmail(email);
        setIsEmailVerificationRequired(true);
        setError("Confirme seu e-mail para continuar.");
        return;
      }

      if (signInOutcome === "account_suspended") {
        setIsAccessBlocked(true);
        setError(
          "Sua conta está suspensa. Entre em contato com o suporte para solicitar uma revisão."
        );
        return;
      }

      if (signInOutcome !== "authenticated") {
        setError("E-mail ou senha incorretos.");
        return;
      }

      const redirectResponse = await fetch(getAuthRedirectPath(safeReturnTo), {
        credentials: "same-origin",
        headers: { "ngrok-skip-browser-warning": "true" },
      });

      if (redirectResponse.status === 403) {
        await fetch("/api/auth/sign-out", { method: "POST" }).catch(
          () => undefined
        );
        setIsAccessBlocked(true);
        setError(
          "Sua conta está suspensa. Entre em contato com o suporte para solicitar uma revisão."
        );
        return;
      }

      if (!redirectResponse.ok) {
        setError("Não foi possível confirmar sua sessão. Tente novamente.");
        return;
      }

      const data = (await redirectResponse.json()) as {
        redirectTo?: string;
      };

      window.location.assign(data.redirectTo ?? "/app");
    } catch {
      setError("Não foi possível concluir o login. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  };

  const handleResendEmailVerification = async (): Promise<void> => {
    setIsVerificationRequestPending(true);
    setVerificationNotice(null);
    try {
      await fetch("/api/auth/send-verification-email", {
        body: JSON.stringify({ email: verificationEmail }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        method: "POST",
      });
      setVerificationNotice(
        "Se a conta puder receber uma confirmação, enviaremos um novo link para esse e-mail."
      );
    } catch {
      setVerificationNotice(
        "Não foi possível solicitar o link agora. Tente novamente em instantes."
      );
    } finally {
      setIsVerificationRequestPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {emailVerified ? (
        <Alert aria-live="polite" className="mb-5">
          <AlertDescription>
            E-mail confirmado. Entre com Google ou crie uma senha por “Esqueci
            minha senha”.
          </AlertDescription>
        </Alert>
      ) : null}
      {emailVerificationFailed ? (
        <Alert aria-live="polite" className="mb-5" variant="destructive">
          <AlertDescription>
            Este link não pôde ser confirmado. Solicite outro e tente novamente.
          </AlertDescription>
        </Alert>
      ) : null}
      {googleOAuthCallbackUrl ? (
        <GoogleAuthButton
          callbackUrl={googleOAuthCallbackUrl}
          enabled={googleLoginEnabled}
          label="Entrar com Google"
        />
      ) : null}
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            aria-describedby={error ? "sign-in-error" : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="email"
            className="h-11"
            id="email"
            name="email"
            onChange={() => {
              if (isEmailVerificationRequired) {
                setIsEmailVerificationRequired(false);
                setVerificationNotice(null);
                setError(null);
              }
            }}
            placeholder="aluno@exemplo.com"
            required
            type="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <PasswordInput
            aria-describedby={error ? "sign-in-error" : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="current-password"
            className="h-11"
            id="password"
            name="password"
            placeholder="Digite sua senha…"
            required
          />
        </Field>
      </FieldGroup>
      {error ? (
        <Alert
          className="mt-5"
          variant={isEmailVerificationRequired ? "default" : "destructive"}
        >
          <AlertDescription id="sign-in-error">
            {error}
            {isAccessBlocked && supportEmail ? (
              <span className="mt-1 block">
                <a
                  className="font-medium text-foreground focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
                  href={`mailto:${supportEmail}?subject=${encodeURIComponent("Acesso bloqueado na conta")}`}
                >
                  Enviar e-mail para {supportEmail}
                </a>
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {isEmailVerificationRequired ? (
        <div className="mt-3 space-y-2">
          <Button
            className="w-full"
            disabled={isVerificationRequestPending}
            loading={isVerificationRequestPending}
            onClick={handleResendEmailVerification}
            type="button"
            variant="outline"
          >
            Reenviar confirmação de e-mail
          </Button>
          {verificationNotice ? (
            <p aria-live="polite" className="text-muted-foreground text-sm">
              {verificationNotice}
            </p>
          ) : null}
        </div>
      ) : null}
      <Button className="mt-5 h-12 w-full" loading={isPending} type="submit">
        Entrar
      </Button>
      <Link
        className="mt-4 inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        href={route("/recuperar-senha")}
      >
        Esqueci minha senha
      </Link>
    </form>
  );
}
