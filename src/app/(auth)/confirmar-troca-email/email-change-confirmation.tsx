"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/routes";

interface EmailChangePreview {
  currentEmail: string;
  expiresAt: string;
  newEmail: string;
  stage: "awaiting_new" | "completed" | "pending_current" | "pending_new";
  userName: string;
}

type ViewState =
  | "awaiting-new"
  | "completed"
  | "error"
  | "loading"
  | "ready"
  | "submitting"
  | "unavailable";

const getPreview = (value: unknown): EmailChangePreview | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const change = Reflect.get(value, "change");
  if (
    Reflect.get(value, "status") !== "ready" ||
    !change ||
    typeof change !== "object"
  ) {
    return null;
  }
  const currentEmail = Reflect.get(change, "currentEmail");
  const expiresAt = Reflect.get(change, "expiresAt");
  const newEmail = Reflect.get(change, "newEmail");
  const stage = Reflect.get(change, "stage");
  const userName = Reflect.get(change, "userName");
  if (
    typeof currentEmail !== "string" ||
    typeof expiresAt !== "string" ||
    typeof newEmail !== "string" ||
    (stage !== "pending_current" &&
      stage !== "pending_new" &&
      stage !== "awaiting_new" &&
      stage !== "completed") ||
    typeof userName !== "string" ||
    Number.isNaN(Date.parse(expiresAt))
  ) {
    return null;
  }
  return { currentEmail, expiresAt, newEmail, stage, userName };
};

const requestPreview = async (token: string): Promise<EmailChangePreview> => {
  const response = await fetch("/api/account/email-changes/preview", {
    body: JSON.stringify({ token }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    method: "POST",
  });
  if (response.status >= 500) {
    throw new Error("unavailable");
  }
  if (!response.ok) {
    throw new Error("invalid");
  }
  const preview = getPreview(await response.json());
  if (!preview) {
    throw new Error("invalid");
  }
  return preview;
};

const getPreviewState = (preview: EmailChangePreview): ViewState => {
  if (preview.stage === "awaiting_new") {
    return "awaiting-new";
  }
  return preview.stage === "completed" ? "completed" : "ready";
};

const getSafeConfirmationPath = (
  responseOk: boolean,
  result: unknown
): string | null => {
  if (
    !(responseOk && result) ||
    typeof result !== "object" ||
    Reflect.get(result, "status") !== "confirmed"
  ) {
    return null;
  }
  const nextPath = Reflect.get(result, "nextPath");
  if (typeof nextPath !== "string") {
    return null;
  }
  const destination = new URL(nextPath, window.location.origin);
  const isAwaitingNew =
    destination.pathname === "/confirmar-troca-email" &&
    destination.searchParams.get("status") === "awaiting-new";
  const isChanged =
    destination.pathname === "/entrar" &&
    destination.searchParams.get("emailChanged") === "1";
  if (
    destination.origin !== window.location.origin ||
    !(isAwaitingNew || isChanged)
  ) {
    return null;
  }
  return destination.pathname + destination.search;
};

const getConfirmButtonLabel = (
  state: ViewState,
  currentStage: boolean
): string => {
  if (state === "unavailable") {
    return "Tentar novamente";
  }
  return currentStage ? "Confirmar e-mail atual" : "Confirmar novo e-mail";
};

export function EmailChangeConfirmation({
  initialStatus,
}: {
  initialStatus: string | null;
}): React.JSX.Element {
  const [state, setState] = useState<ViewState>(
    initialStatus === "awaiting-new" ? "awaiting-new" : "loading"
  );
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailChangePreview | null>(null);
  const [retryAction, setRetryAction] = useState<"consume" | "preview" | null>(
    null
  );

  useEffect(() => {
    if (initialStatus === "awaiting-new") {
      return;
    }
    let active = true;
    const fragmentParams = new URLSearchParams(window.location.hash.slice(1));
    const challengeToken = fragmentParams.get("token");
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search
    );
    if (!challengeToken || challengeToken.length > 512) {
      setState("error");
      return () => {
        active = false;
      };
    }
    setToken(challengeToken);
    requestPreview(challengeToken)
      .then((result) => {
        if (!active) {
          return;
        }
        setPreview(result);
        setRetryAction(null);
        setState(getPreviewState(result));
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        const unavailable =
          error instanceof Error && error.message === "unavailable";
        setRetryAction(unavailable ? "preview" : null);
        setState(unavailable ? "unavailable" : "error");
      });
    return () => {
      active = false;
    };
  }, [initialStatus]);

  const retryPreview = async (): Promise<void> => {
    if (!token) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const result = await requestPreview(token);
      setPreview(result);
      setRetryAction(null);
      setState(getPreviewState(result));
    } catch (error) {
      const unavailable =
        error instanceof Error && error.message === "unavailable";
      setRetryAction(unavailable ? "preview" : null);
      setState(unavailable ? "unavailable" : "error");
    }
  };

  const confirm = async (): Promise<void> => {
    if (!(token && preview)) {
      setState("error");
      return;
    }
    setRetryAction(null);
    setState("submitting");
    try {
      const response = await fetch("/api/account/email-changes/consume", {
        body: JSON.stringify({ token }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        method: "POST",
      });
      if (response.status >= 500) {
        setRetryAction("consume");
        setState("unavailable");
        return;
      }
      const path = getSafeConfirmationPath(response.ok, await response.json());
      if (!path) {
        setState("error");
        return;
      }
      window.location.assign(path);
    } catch {
      setRetryAction("consume");
      setState("unavailable");
    }
  };

  if (state === "loading") {
    return (
      <p aria-live="polite" className="text-muted-foreground text-sm">
        Validando confirmação…
      </p>
    );
  }
  if (state === "awaiting-new") {
    return (
      <div className="space-y-5">
        <Alert variant="success">
          <AlertTitle>E-mail atual confirmado</AlertTitle>
          <AlertDescription>
            Agora confirme o novo endereço pelo link enviado para ele. Seu
            e-mail de acesso só muda depois dessa segunda confirmação.
          </AlertDescription>
        </Alert>
        <Link
          className="inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          href={route("/entrar")}
        >
          Voltar ao login
        </Link>
      </div>
    );
  }
  if (state === "completed") {
    return (
      <div className="space-y-5">
        <Alert variant="success">
          <AlertTitle>E-mail atualizado</AlertTitle>
          <AlertDescription>
            A troca já foi concluída. Entre usando o novo endereço; avisos foram
            enviados aos dois e-mails.
          </AlertDescription>
        </Alert>
        <Link
          className="inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          href={route("/entrar")}
        >
          Ir para o login
        </Link>
      </div>
    );
  }
  if (state === "error" || (!preview && state !== "unavailable")) {
    return (
      <div className="space-y-5">
        <Alert aria-live="polite" variant="destructive">
          <AlertTitle>Este link não está mais válido</AlertTitle>
          <AlertDescription>
            Ele pode ter expirado, sido usado ou substituído. Entre na sua Conta
            e solicite uma nova alteração.
          </AlertDescription>
        </Alert>
        <Link
          className="inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          href={route("/entrar")}
        >
          Voltar ao login
        </Link>
      </div>
    );
  }
  if (state === "unavailable" && !preview) {
    return (
      <div className="space-y-5">
        <Alert>
          <AlertTitle>Não foi possível validar agora</AlertTitle>
          <AlertDescription>
            Sua solicitação não foi alterada. Tente novamente em instantes.
          </AlertDescription>
        </Alert>
        <Button className="w-full" onClick={retryPreview} type="button">
          Tentar novamente
        </Button>
      </div>
    );
  }
  if (!preview) {
    return <p role="status">Preparando a confirmação…</p>;
  }

  const expiresAtLabel = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(preview.expiresAt));
  const currentStage = preview.stage === "pending_current";
  const destination = currentStage ? preview.currentEmail : preview.newEmail;

  return (
    <div className="space-y-5">
      {state === "unavailable" ? (
        <Alert>
          <AlertTitle>Não foi possível confirmar o resultado</AlertTitle>
          <AlertDescription>
            Tentar novamente é seguro; o mesmo link não conclui a alteração duas
            vezes.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="info">
          <AlertTitle>
            {currentStage ? "Autorize a alteração" : "Confirme o novo endereço"}
          </AlertTitle>
          <AlertDescription>
            {currentStage
              ? "Este passo prova que você controla o e-mail atual e autoriza a solicitação de alteração."
              : "Este passo prova que você controla o novo endereço. O e-mail só muda após esta confirmação."}
          </AlertDescription>
        </Alert>
      )}
      <div className="rounded-card border bg-muted/20 p-4">
        <p className="font-medium">{preview.userName}</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Link enviado para{" "}
          <span className="break-all font-medium text-foreground">
            {destination}
          </span>
        </p>
        <p className="mt-2 text-muted-foreground text-xs">
          Válido até {expiresAtLabel} (horário de Brasília).
        </p>
      </div>
      <Button
        className="h-12 w-full"
        loading={state === "submitting"}
        onClick={
          state === "unavailable" && retryAction === "preview"
            ? retryPreview
            : confirm
        }
        type="button"
      >
        {getConfirmButtonLabel(state, currentStage)}
      </Button>
      <p className="text-muted-foreground text-xs">
        Esta confirmação não inicia uma sessão nem troca o e-mail antes da
        validação do novo endereço.
      </p>
      <Link
        className="inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
        href={route("/entrar")}
      >
        Voltar ao login
      </Link>
    </div>
  );
}
