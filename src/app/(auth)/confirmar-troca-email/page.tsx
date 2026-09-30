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
import { EmailChangeConfirmation } from "./email-change-confirmation";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Confirmar alteração de e-mail",
};
export const dynamic = "force-dynamic";

export default async function ConfirmEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] | undefined }>;
}): Promise<React.JSX.Element> {
  await connection();
  const { status } = await searchParams;
  const initialStatus =
    status === "awaiting-new" ||
    (Array.isArray(status) && status[0] === "awaiting-new")
      ? "awaiting-new"
      : null;

  return (
    <AuthShell formSide="left">
      <Card className="mx-auto w-full max-w-md gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-6">
          <CardTitle as="h1" className="type-page-title">
            Confirme a alteração do e-mail
          </CardTitle>
          <CardDescription>
            A mudança só acontece depois que os dois endereços são confirmados.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <EmailChangeConfirmation initialStatus={initialStatus} />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
