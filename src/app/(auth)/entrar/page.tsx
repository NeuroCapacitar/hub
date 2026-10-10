import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ReauthenticateButton } from "@/components/account/reauthenticate-button";
import { AuthShell } from "@/components/auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isGoogleOAuthProviderConfigured } from "@/lib/auth-policy";
import {
  getGoogleOAuthCallbackUrl,
  getSafeAuthReturnTo,
} from "@/lib/auth-return-to";
import { getServerEnv } from "@/lib/env";
import { route } from "@/lib/routes";
import { getCurrentSession } from "@/lib/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Entrar",
};
export const dynamic = "force-dynamic";

type QueryValue = string | string[] | undefined;

const matchesQueryValue = (value: QueryValue, expected: string): boolean =>
  value === expected ||
  (Array.isArray(value) && value.length === 1 && value[0] === expected);

const hasQueryValue = (value: QueryValue): boolean =>
  typeof value === "string"
    ? value.length > 0
    : Array.isArray(value) && value.length > 0;

const isEmailVerificationFailed = (
  emailVerified: QueryValue,
  error: QueryValue
): boolean => matchesQueryValue(emailVerified, "1") && hasQueryValue(error);

const getSignInDescription = ({
  blockedStudent,
  returnTo,
}: {
  blockedStudent: boolean;
  returnTo: string | null;
}): string => {
  if (blockedStudent) {
    return "O acesso à sua conta está suspenso. Fale com o suporte para solicitar uma revisão.";
  }
  if (returnTo?.startsWith("/comprar/")) {
    return "Entre para voltar ao Curso e confirmar sua inscrição gratuita.";
  }
  return "Acesse sua conta para continuar seus estudos.";
};

const getSessionRedirectPath = ({
  role,
  blockedStudent,
  safeReturnTo,
}: {
  blockedStudent: boolean;
  role: "admin" | "student" | "support";
  safeReturnTo: string | null;
}): string | null => {
  if (blockedStudent) {
    return null;
  }
  if (role === "student") {
    return safeReturnTo ?? "/app";
  }
  return "/admin";
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    emailChanged?: string | string[] | undefined;
    emailVerified?: string | string[] | undefined;
    error?: string | string[] | undefined;
    returnTo?: string | string[] | undefined;
  }>;
}): Promise<React.JSX.Element> {
  await connection();
  const env = getServerEnv();
  const supportEmail = env.SUPPORT_EMAIL ?? null;
  const googleLoginEnabled = isGoogleOAuthProviderConfigured({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  });
  const [
    {
      emailChanged: emailChangedValues,
      emailVerified: emailVerifiedValues,
      error,
      returnTo,
    },
    session,
  ] = await Promise.all([searchParams, getCurrentSession()]);
  const safeReturnTo = getSafeAuthReturnTo(returnTo);
  const blockedStudent =
    session?.role === "student" && Boolean(session.platformBlockedAt);
  const emailVerificationFailed = isEmailVerificationFailed(
    emailVerifiedValues,
    error
  );
  const emailVerified =
    matchesQueryValue(emailVerifiedValues, "1") && !emailVerificationFailed;
  const emailChanged = matchesQueryValue(emailChangedValues, "1");
  const googleOAuthCallbackUrl = getGoogleOAuthCallbackUrl({
    appUrl: env.BETTER_AUTH_URL,
    returnTo: safeReturnTo,
  });

  if (session) {
    const redirectPath = getSessionRedirectPath({
      blockedStudent,
      role: session.role,
      safeReturnTo,
    });
    if (redirectPath) {
      redirect(route(redirectPath));
    }
  }

  return (
    <AuthShell formSide="right">
      <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-6">
          <CardTitle as="h1" className="type-page-title">
            Bem-vinda de volta
          </CardTitle>
          <CardDescription>
            {getSignInDescription({ blockedStudent, returnTo: safeReturnTo })}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {emailChanged ? (
            <Alert className="mb-5" variant="success">
              <AlertTitle>E-mail atualizado</AlertTitle>
              <AlertDescription>
                Entre usando o novo endereço. Você receberá avisos nos dois
                e-mails cadastrados.
              </AlertDescription>
            </Alert>
          ) : null}
          {blockedStudent ? (
            <div className="space-y-5">
              <Alert variant="destructive">
                <AlertTitle>Acesso à plataforma suspenso</AlertTitle>
                <AlertDescription>
                  Esta Conta não pode acessar áreas internas do Hub enquanto a
                  suspensão estiver ativa. Fale com o suporte para solicitar uma
                  revisão.
                </AlertDescription>
              </Alert>
              <div className="flex flex-col gap-3 sm:flex-row">
                {supportEmail ? (
                  <Button asChild className="flex-1" variant="outline">
                    <a
                      href={`mailto:${supportEmail}?subject=${encodeURIComponent("Revisão de acesso à conta")}`}
                    >
                      Falar com o suporte
                    </a>
                  </Button>
                ) : null}
                <ReauthenticateButton label="Sair da conta" />
              </div>
            </div>
          ) : (
            <SignInForm
              allowPublicSignup={env.AUTH_PUBLIC_SIGNUP_ENABLED}
              emailVerificationFailed={emailVerificationFailed}
              emailVerified={emailVerified}
              googleLoginEnabled={googleLoginEnabled}
              googleOAuthCallbackUrl={googleOAuthCallbackUrl}
              returnTo={safeReturnTo}
              supportEmail={supportEmail}
            />
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
