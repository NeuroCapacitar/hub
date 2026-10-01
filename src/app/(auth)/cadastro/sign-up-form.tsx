"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getAuthSignInPath, getSafeAuthReturnTo } from "@/lib/auth-return-to";

export function SignUpForm({
  googleLoginEnabled = false,
  googleOAuthCallbackUrl,
  returnTo = null,
}: {
  googleLoginEnabled?: boolean;
  googleOAuthCallbackUrl?: string;
  returnTo?: string | null;
} = {}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const safeReturnTo = getSafeAuthReturnTo(returnTo);
  const signInHref = getAuthSignInPath(safeReturnTo);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    setIsPending(true);

    try {
      const response = await fetch("/api/account/registrations", {
        body: JSON.stringify({
          email: formData.get("email"),
          name: formData.get("name"),
          ...(safeReturnTo ? { returnTo: safeReturnTo } : {}),
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        method: "POST",
      });
      const result: unknown = await response.json();
      if (
        !(response.ok && result) ||
        typeof result !== "object" ||
        Reflect.get(result, "status") !== "accepted"
      ) {
        setError("Não foi possível solicitar a confirmação. Tente novamente.");
        return;
      }
      setRequestSent(true);
    } catch {
      setError("Não foi possível solicitar a confirmação. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {googleLoginEnabled && googleOAuthCallbackUrl ? (
        <GoogleAuthButton
          callbackUrl={googleOAuthCallbackUrl}
          label="Criar conta com Google"
          requestSignUp
        />
      ) : null}
      {requestSent ? (
        <div aria-live="polite" className="space-y-2">
          <h2 className="font-semibold">Confira seu e-mail</h2>
          <p className="text-muted-foreground text-sm">
            Se esse endereço puder criar ou confirmar uma conta, enviaremos um
            link. Abra-o para continuar; por segurança, o link expira em uma
            hora.
          </p>
        </div>
      ) : (
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="name">Nome completo</FieldLabel>
            <Input
              autoComplete="name"
              className="h-11"
              id="name"
              maxLength={120}
              name="name"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input
              autoComplete="email"
              className="h-11"
              id="email"
              maxLength={254}
              name="email"
              placeholder="aluno@exemplo.com"
              required
              type="email"
            />
          </Field>
        </FieldGroup>
      )}
      {error ? (
        <Alert className="mt-5" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {requestSent ? null : (
        <Button className="mt-5 h-12 w-full" loading={isPending} type="submit">
          Enviar link de confirmação
        </Button>
      )}
      <Link
        className="mt-4 inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
        href={signInHref}
      >
        Já tenho uma conta
      </Link>
    </form>
  );
}
