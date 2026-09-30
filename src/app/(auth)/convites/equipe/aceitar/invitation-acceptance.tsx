"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { route } from "@/lib/routes";

type InvitationRole = "admin" | "support";

interface InvitationPreview {
  alreadyAccepted: boolean;
  email: string;
  existingStudent: boolean;
  expiresAt: string;
  inviterName: string;
  requiresName: boolean;
  role: InvitationRole;
  willRemovePassword: boolean;
}

type ViewState =
  | "accepted"
  | "error"
  | "loading"
  | "ready"
  | "submitting"
  | "unavailable";
type RetryAction = "accept" | "preview" | null;

const getPreview = (value: unknown): InvitationPreview | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const status = Reflect.get(value, "status");
  const invitation = Reflect.get(value, "invitation");
  if (status !== "ready" || !invitation || typeof invitation !== "object") {
    return null;
  }
  const role = Reflect.get(invitation, "role");
  const alreadyAccepted = Reflect.get(invitation, "alreadyAccepted");
  const email = Reflect.get(invitation, "email");
  const expiresAt = Reflect.get(invitation, "expiresAt");
  const inviterName = Reflect.get(invitation, "inviterName");
  const existingStudent = Reflect.get(invitation, "existingStudent");
  const requiresName = Reflect.get(invitation, "requiresName");
  const willRemovePassword = Reflect.get(invitation, "willRemovePassword");
  if (
    (role !== "admin" && role !== "support") ||
    typeof alreadyAccepted !== "boolean" ||
    typeof email !== "string" ||
    typeof expiresAt !== "string" ||
    typeof inviterName !== "string" ||
    typeof existingStudent !== "boolean" ||
    typeof requiresName !== "boolean" ||
    typeof willRemovePassword !== "boolean" ||
    Number.isNaN(Date.parse(expiresAt))
  ) {
    return null;
  }
  return {
    alreadyAccepted,
    email,
    existingStudent,
    expiresAt,
    inviterName,
    requiresName,
    role,
    willRemovePassword,
  };
};

const requestInvitationPreview = async (
  challengeToken: string
): Promise<InvitationPreview> => {
  const response = await fetch("/api/account/staff-invitations/preview", {
    body: JSON.stringify({ token: challengeToken }),
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

const submitInvitationAcceptance = async ({
  name,
  token,
}: {
  name: string;
  token: string;
}): Promise<string> => {
  const response = await fetch("/api/account/staff-invitations/accept", {
    body: JSON.stringify({ name: name.trim(), token }),
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    method: "POST",
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    throw new Error(response.status >= 500 ? "unavailable" : "invalid");
  }
  const nextPath =
    result && typeof result === "object"
      ? Reflect.get(result, "nextPath")
      : null;
  const safeNextPath =
    typeof nextPath === "string"
      ? new URL(nextPath, window.location.origin)
      : null;
  if (
    !result ||
    typeof result !== "object" ||
    Reflect.get(result, "status") !== "accepted" ||
    !safeNextPath ||
    safeNextPath.origin !== window.location.origin ||
    safeNextPath.pathname !== "/entrar" ||
    safeNextPath.searchParams.get("returnTo") !== "/admin"
  ) {
    throw new Error("invalid");
  }
  return safeNextPath.pathname + safeNextPath.search;
};

export function StaffInvitationAcceptance(): React.JSX.Element {
  const [state, setState] = useState<ViewState>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [retryAction, setRetryAction] = useState<RetryAction>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    let active = true;
    const fragmentParams = new URLSearchParams(window.location.hash.slice(1));
    const challengeToken = fragmentParams.get("token");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
    if (!challengeToken || challengeToken.length > 512) {
      setState("error");
      return () => {
        active = false;
      };
    }

    setToken(challengeToken);
    requestInvitationPreview(challengeToken)
      .then((preview) => {
        if (!active) {
          return;
        }
        setInvitation(preview);
        setRetryAction(null);
        setState(preview.alreadyAccepted ? "accepted" : "ready");
      })
      .catch((error: unknown) => {
        if (active) {
          const unavailable =
            error instanceof Error && error.message === "unavailable";
          setRetryAction(unavailable ? "preview" : null);
          setState(unavailable ? "unavailable" : "error");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const accept = async (): Promise<void> => {
    if (!(token && invitation)) {
      setState("error");
      return;
    }
    setRetryAction(null);
    setState("submitting");
    try {
      const nextPath = await submitInvitationAcceptance({ name, token });
      window.location.assign(nextPath);
    } catch (error) {
      const unavailable =
        error instanceof Error && error.message === "unavailable";
      setRetryAction(unavailable ? "accept" : null);
      setState(unavailable ? "unavailable" : "error");
    }
  };

  const retryPreview = async (): Promise<void> => {
    if (!token) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      const preview = await requestInvitationPreview(token);
      setInvitation(preview);
      setRetryAction(null);
      setState(preview.alreadyAccepted ? "accepted" : "ready");
    } catch (error) {
      const unavailable =
        error instanceof Error && error.message === "unavailable";
      setRetryAction(unavailable ? "preview" : null);
      setState(unavailable ? "unavailable" : "error");
    }
  };

  if (state === "loading") {
    return (
      <p aria-live="polite" className="text-muted-foreground text-sm">
        Validando convite…
      </p>
    );
  }
  if (state === "unavailable" && !invitation) {
    return (
      <div className="space-y-5">
        <Alert aria-live="polite">
          <AlertTitle>Não foi possível validar agora</AlertTitle>
          <AlertDescription>
            O convite não foi alterado. Tente novamente em instantes.
          </AlertDescription>
        </Alert>
        <Button className="w-full" onClick={retryPreview} type="button">
          Tentar novamente
        </Button>
      </div>
    );
  }
  if (state === "error" || !invitation) {
    return (
      <div className="space-y-5">
        <Alert aria-live="polite" variant="destructive">
          <AlertTitle>Este convite não está mais válido</AlertTitle>
          <AlertDescription>
            Ele pode ter expirado, sido cancelado ou substituído. Peça à equipe
            que envie um novo convite.
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
  if (state === "accepted" || invitation.alreadyAccepted) {
    return (
      <div className="space-y-5">
        <Alert variant="success">
          <AlertTitle>Este convite já foi aceito</AlertTitle>
          <AlertDescription>
            Entre com o e-mail convidado para acessar a área da equipe.
          </AlertDescription>
        </Alert>
        <Link
          className="inline-flex text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          href={route("/entrar?returnTo=%2Fadmin")}
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  const expiresLabel = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(invitation.expiresAt));
  const roleLabel = invitation.role === "admin" ? "Admin" : "Suporte";

  return (
    <div className="space-y-5">
      <div className="rounded-card border bg-muted/20 p-4">
        <p className="font-medium">Convite de {invitation.inviterName}</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Acesso de {roleLabel} para{" "}
          <span className="font-medium text-foreground">
            {invitation.email}
          </span>
        </p>
        <p className="mt-2 text-muted-foreground text-xs">
          Válido até {expiresLabel} (horário de Brasília).
        </p>
      </div>

      {invitation.existingStudent ? (
        <Alert variant="warning">
          <AlertTitle>Seu acesso de Aluno será alterado</AlertTitle>
          <AlertDescription>
            Ao aceitar, você passará a usar a área administrativa e deixará de
            acessar a área de aprendizagem. Matrículas, pedidos, progresso e
            certificados serão preservados; nada será apagado.
            {invitation.willRemovePassword ? (
              <>
                {" "}
                Como seu e-mail ainda não estava verificado, a senha local
                antiga será removida. Depois, entre com Google ou use “Esqueci
                minha senha” para criar uma nova.
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {state === "unavailable" ? (
        <Alert aria-live="polite">
          <AlertTitle>Não foi possível confirmar o resultado</AlertTitle>
          <AlertDescription>
            Seu convite pode já ter sido aceito. Tentar novamente é seguro e não
            aplica o acesso duas vezes.
          </AlertDescription>
        </Alert>
      ) : null}

      {invitation.requiresName ? (
        <Field className="gap-2">
          <FieldLabel htmlFor="staff-invitation-name">Nome completo</FieldLabel>
          <Input
            autoComplete="name"
            id="staff-invitation-name"
            maxLength={120}
            minLength={2}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
          <FieldDescription>
            Você poderá entrar com Google ou criar uma senha depois.
          </FieldDescription>
        </Field>
      ) : null}

      <Button
        className="h-12 w-full"
        disabled={invitation.requiresName && name.trim().length < 2}
        loading={state === "submitting"}
        onClick={
          state === "unavailable" && retryAction === "preview"
            ? retryPreview
            : accept
        }
        type="button"
      >
        {state === "unavailable"
          ? "Tentar novamente"
          : "Aceitar convite e continuar"}
      </Button>
      <p className="text-muted-foreground text-xs">
        O aceite confirma o acesso ao e-mail acima, não à sessão atual. Se você
        estiver conectado com outro e-mail, saia dessa Conta e entre com o
        endereço convidado. O link não inicia uma sessão.
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
