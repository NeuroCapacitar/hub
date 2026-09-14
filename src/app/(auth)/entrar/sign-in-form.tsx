"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { route } from "@/lib/routes";
import { getSignInOutcome } from "./sign-in-result";

export function SignInForm(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/auth/sign-in/email", {
        body: JSON.stringify({
          email: formData.get("email"),
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

      const signInOutcome = response.ok ? getSignInOutcome(payload) : "failure";

      if (signInOutcome !== "authenticated") {
        setError("E-mail ou senha incorretos.");
        return;
      }

      const redirectResponse = await fetch("/api/auth/redirect", {
        credentials: "same-origin",
        headers: { "ngrok-skip-browser-warning": "true" },
      });

      if (redirectResponse.status === 403) {
        await fetch("/api/auth/sign-out", { method: "POST" }).catch(
          () => undefined
        );
        setError(
          "Acesso bloqueado. Entre em contato com o suporte para revisar sua conta."
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

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            aria-describedby={error ? "sign-in-error" : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="email"
            id="email"
            name="email"
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
            id="password"
            name="password"
            placeholder="Digite sua senha…"
            required
          />
        </Field>
      </FieldGroup>
      {error ? (
        <Alert className="mt-5" variant="destructive">
          <AlertDescription id="sign-in-error">{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="mt-5 h-12 w-full" loading={isPending} type="submit">
        Entrar
      </Button>
      <Link
        className="mt-5 inline-flex text-sm text-support-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        href={route("/recuperar-senha")}
      >
        Esqueci minha senha
      </Link>
    </form>
  );
}
