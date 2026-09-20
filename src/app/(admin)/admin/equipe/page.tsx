import Link from "next/link";
import { StaffPromotionDialog } from "@/components/admin/staff-promotion-dialog";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStaffMembers } from "@/features/admin/staff-server";
import { requirePermission } from "@/lib/auth-permissions";
import { StaffAccessTable } from "./staff-access-table";

export const dynamic = "force-dynamic";

export default async function StaffPage(): Promise<React.JSX.Element> {
  const session = await requirePermission("manageStaffAccess");
  const members = await getStaffMembers();

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader title="Equipe" />
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle as="h2">Contas com acesso administrativo</CardTitle>
            <CardDescription>
              Admins têm acesso total. O acesso do Suporte combina a leitura
              administrativa padrão com as permissões delegáveis marcadas pelo
              Admin. Adicione uma conta à equipe somente depois de revisar a
              alteração.
            </CardDescription>
            <CardAction className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/admin/alunos">Ver Alunos</Link>
              </Button>
              <StaffPromotionDialog />
            </CardAction>
          </CardHeader>
          <CardContent>
            <StaffAccessTable actorUserId={session.user.id} members={members} />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
