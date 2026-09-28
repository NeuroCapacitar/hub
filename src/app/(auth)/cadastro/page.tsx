import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAuthSignInPath,
  getGoogleOAuthCallbackUrl,
  getSafeAuthReturnTo,
} from "@/lib/auth-return-to";
import { getServerEnv } from "@/lib/env";
import { route } from "@/lib/routes";
import { getCurrentSession } from "@/lib/session";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Criar conta",
};
export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  await connection();
  const env = getServerEnv();
  const googleLoginEnabled = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  );
  const publicSignupEnabled = env.AUTH_PUBLIC_SIGNUP_ENABLED;
  const [{ returnTo }, session] = await Promise.all([
    searchParams,
    getCurrentSession(),
  ]);
  const safeReturnTo = getSafeAuthReturnTo(returnTo);

  if (session && !(session.role === "student" && session.platformBlockedAt)) {
    redirect(
      route(session.role === "student" ? (safeReturnTo ?? "/app") : "/admin")
    );
  }

  if (!publicSignupEnabled) {
    return (
      <AuthShell formSide="left">
        <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
          <CardHeader className="gap-2 px-0 pb-6">
            <CardTitle as="h1" className="type-page-title">
              Cadastro indisponível
            </CardTitle>
            <CardDescription>
              No momento, novas contas não podem ser criadas por esta página.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <p className="mb-5 text-muted-foreground text-sm">
              Se você já tem uma conta ou comprou um curso, entre para
              continuar.
            </p>
            <Button asChild className="h-12 w-full">
              <Link href={getAuthSignInPath(safeReturnTo)}>Entrar</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  const googleOAuthCallbackUrl = getGoogleOAuthCallbackUrl({
    appUrl: env.BETTER_AUTH_URL,
    returnTo: safeReturnTo,
  });

  return (
    <AuthShell formSide="left">
      <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-6">
          <CardTitle as="h1" className="type-page-title">
            Crie sua conta
          </CardTitle>
          <CardDescription>
            {safeReturnTo?.startsWith("/comprar/")
              ? "Depois de criar sua conta, você voltará ao Curso para confirmar sua inscrição gratuita."
              : "A conta dá acesso à plataforma. Os cursos são liberados separadamente."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <SignUpForm
            googleLoginEnabled={googleLoginEnabled}
            googleOAuthCallbackUrl={googleOAuthCallbackUrl}
            returnTo={safeReturnTo}
          />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
