import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthShell } from "@/components/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailChallengeConfirmation } from "./email-challenge-confirmation";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Confirmar e-mail",
};
export const dynamic = "force-dynamic";

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ legacy?: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  await connection();
  const { legacy } = await searchParams;
  const legacyLink =
    legacy === "1" || (Array.isArray(legacy) && legacy[0] === "1");

  return (
    <AuthShell formSide="left">
      <Card className="mx-auto w-full max-w-sm gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-6">
          <CardTitle as="h1" className="type-page-title">
            Confirme seu e-mail
          </CardTitle>
          <CardDescription>
            Esta etapa protege sua conta e mantém seu acesso sob seu controle.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <EmailChallengeConfirmation legacyLink={legacyLink} />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
