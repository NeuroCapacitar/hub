import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PASSWORD_MIN_LENGTH_MESSAGE } from "@/lib/password-policy";
import { route } from "@/lib/routes";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Definir senha",
};
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}): Promise<React.JSX.Element> {
  const { token } = await searchParams;

  return (
    <AuthShell formSide="left">
      <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-6">
          <CardTitle as="h1" className="type-page-title">
            Definir nova senha
          </CardTitle>
          <CardDescription>{PASSWORD_MIN_LENGTH_MESSAGE}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ResetPasswordForm token={token ?? ""} />
        </CardContent>
        <CardFooter className="px-0 pt-6">
          <Link
            className="inline-flex text-muted-foreground text-sm hover:text-foreground"
            href={route("/entrar")}
          >
            Voltar para login
          </Link>
        </CardFooter>
      </Card>
    </AuthShell>
  );
}
