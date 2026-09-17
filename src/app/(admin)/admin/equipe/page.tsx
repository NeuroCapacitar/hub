import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import {
  Card,
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
        <PageHeader
          description="Administre o papel e as permissões de alteração das Contas existentes. Esta área não cria credenciais nem redefine senhas."
          title="Equipe"
        />
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle as="h2">Contas administráveis</CardTitle>
            <CardDescription>
              Todo Suporte mantém a leitura administrativa aprovada. As
              alterações ficam limitadas às permissões delegáveis marcadas pelo
              Admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StaffAccessTable actorUserId={session.user.id} members={members} />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
