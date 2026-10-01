"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/routes";

type ConfirmationState = "error" | "loading" | "ready" | "submitting";

export function EmailChallengeConfirmation({
  legacyLink = false,
}: {
  legacyLink?: boolean;
}): React.JSX.Element {
  const [state, setState] = useState<ConfirmationState>(
    legacyLink ? "error" : "loading"
  );
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (legacyLink) {
      return;
    }

    const fragment = window.location.hash.slice(1);
    const fragmentParams = new URLSearchParams(fragment);
    const challengeToken = fragmentParams.get("token");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );

    if (!challengeToken || challengeToken.length > 512) {
      setState("error");
      return;
    }

    setToken(challengeToken);
    setState("ready");
  }, [legacyLink]);

  const confirmEmail = async (): Promise<void> => {
    if (!token) {
      setState("error");
      return;
    }

    setState("submitting");
    try {
      const response = await fetch("/api/account/email-challenges/consume", {
        body: JSON.stringify({ token }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        method: "POST",
      });
      const result: unknown = await response.json();
      const nextPath =
        result && typeof result === "object"
          ? Reflect.get(result, "nextPath")
          : null;
      const safeNextPath =
        typeof nextPath === "string"
          ? new URL(nextPath, window.location.origin)
          : null;
      if (
        !(response.ok && result) ||
        typeof result !== "object" ||
        Reflect.get(result, "status") !== "confirmed" ||
        !safeNextPath ||
        safeNextPath.origin !== window.location.origin ||
        safeNextPath.pathname !== "/entrar"
      ) {
        setState("error");
        return;
      }

      window.location.assign(
        `${safeNextPath.pathname}${safeNextPath.search}${safeNextPath.hash}`
      );
    } catch {
      setState("error");
    }
  };

  const expired = state === "error";

  return (
    <div className="space-y-5">
      {legacyLink ? (
        <Alert aria-live="polite" variant="destructive">
          <AlertDescription>
            Este link pertence ao fluxo anterior e não pode confirmar sua conta.
            Volte ao login para solicitar uma nova confirmação.
          </AlertDescription>
        </Alert>
      ) : null}
      {expired && !legacyLink ? (
        <Alert aria-live="polite" variant="destructive">
          <AlertDescription>
            Este link é inválido ou expirou. Volte ao login e solicite uma nova
            confirmação.
          </AlertDescription>
        </Alert>
      ) : null}
      {expired || legacyLink ? null : (
        <p className="text-muted-foreground text-sm">
          Confirme que você tem acesso a este endereço de e-mail. A confirmação
          não inicia uma sessão nem define uma senha.
        </p>
      )}
      {state === "ready" || state === "submitting" ? (
        <Button
          className="h-12 w-full"
          loading={state === "submitting"}
          onClick={confirmEmail}
          type="button"
        >
          Confirmar e-mail
        </Button>
      ) : null}
      {state === "loading" ? (
        <p aria-live="polite" className="text-muted-foreground text-sm">
          Preparando a confirmação…
        </p>
      ) : null}
      <Link
        className="inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        href={route("/entrar")}
      >
        Voltar ao login
      </Link>
    </div>
  );
}
