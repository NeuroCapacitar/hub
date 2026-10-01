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
import { StaffInvitationAcceptance } from "./invitation-acceptance";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Aceitar convite da equipe",
};
export const dynamic = "force-dynamic";

export default async function AcceptStaffInvitationPage(): Promise<React.JSX.Element> {
  await connection();

  return (
    <AuthShell formSide="left">
      <Card className="mx-auto w-full max-w-md gap-0 overflow-visible rounded-none bg-transparent px-0 py-0 shadow-none ring-0">
        <CardHeader className="gap-2 px-0 pb-6">
          <CardTitle as="h1" className="type-page-title">
            Convite para a equipe
          </CardTitle>
          <CardDescription>
            Confira o papel e confirme que você tem acesso ao e-mail convidado.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <StaffInvitationAcceptance />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
