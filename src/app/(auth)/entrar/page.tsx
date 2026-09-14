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
import { route } from "@/lib/routes";
import { getCurrentSession } from "@/lib/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Entrar",
};
export const dynamic = "force-dynamic";

export default async function SignInPage(): Promise<React.JSX.Element> {
  await connection();
  const session = await getCurrentSession();

  if (session && !(session.role === "student" && session.platformBlockedAt)) {
    redirect(route(session.role === "student" ? "/app" : "/admin"));
  }

  return (
    <AuthShell formSide="right">
      <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-6">
          <CardTitle as="h1" className="type-page-title">
            Bem-vinda de volta
          </CardTitle>
          <CardDescription>
            Acesse sua conta para continuar seus estudos.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <SignInForm />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
