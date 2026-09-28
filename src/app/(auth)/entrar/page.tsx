import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    emailVerified?: string | string[] | undefined;
    error?: string | string[] | undefined;
    returnTo?: string | string[] | undefined;
  }>;
}): Promise<React.JSX.Element> {
  await connection();
  const env = getServerEnv();
  const supportEmail = env.SUPPORT_EMAIL ?? null;
  const googleLoginEnabled = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  );
  const [{ emailVerified: emailVerifiedValues, error, returnTo }, session] =
    await Promise.all([searchParams, getCurrentSession()]);
  const safeReturnTo = getSafeAuthReturnTo(returnTo);
  const emailVerificationFailed =
    (emailVerifiedValues === "1" ||
      (Array.isArray(emailVerifiedValues) &&
        emailVerifiedValues.length === 1 &&
        emailVerifiedValues[0] === "1")) &&
    (typeof error === "string"
      ? error.length > 0
      : Array.isArray(error) && error.length > 0);
  const emailVerified =
    emailVerifiedValues === "1" ||
    (Array.isArray(emailVerifiedValues) &&
      emailVerifiedValues.length === 1 &&
      emailVerifiedValues[0] === "1")
      ? !emailVerificationFailed
      : false;
  const googleOAuthCallbackUrl = getGoogleOAuthCallbackUrl({
    appUrl: env.BETTER_AUTH_URL,
    returnTo: safeReturnTo,
  });

  if (session && !(session.role === "student" && session.platformBlockedAt)) {
    redirect(
      route(session.role === "student" ? (safeReturnTo ?? "/app") : "/admin")
    );
  }

  return (
    <AuthShell formSide="right">
      <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-6">
          <CardTitle as="h1" className="type-page-title">
            Bem-vinda de volta
          </CardTitle>
          <CardDescription>
            {safeReturnTo?.startsWith("/comprar/")
              ? "Entre para voltar ao Curso e confirmar sua inscrição gratuita."
              : "Acesse sua conta para continuar seus estudos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <SignInForm
            emailVerificationFailed={emailVerificationFailed}
            emailVerified={emailVerified}
            googleLoginEnabled={googleLoginEnabled}
            googleOAuthCallbackUrl={googleOAuthCallbackUrl}
            returnTo={safeReturnTo}
            supportEmail={supportEmail}
          />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
