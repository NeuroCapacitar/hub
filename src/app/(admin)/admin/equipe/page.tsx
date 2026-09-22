import Link from "next/link";
import { StaffPromotionDialog } from "@/components/admin/staff-promotion-dialog";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getStaffMembers } from "@/features/admin/staff-server";
import { requirePermission } from "@/lib/auth-permissions";
import { StaffAccessTable } from "./staff-access-table";

export const dynamic = "force-dynamic";

export default async function StaffPage(): Promise<React.JSX.Element> {
  const session = await requirePermission("manageStaffAccess");
  const members = await getStaffMembers();

  return (
    <PageContainer>
      <div className="flex flex-col gap-16">
        <PageHeader title="Equipe" />
        <section
          aria-labelledby="staff-table-title"
          className="grid min-w-0 gap-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="type-section-title" id="staff-table-title">
                Contas com acesso administrativo
              </h2>
              <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
                Admins têm acesso total. O acesso do Suporte combina a leitura
                administrativa padrão com as permissões delegáveis marcadas pelo
                Admin. Adicione uma conta à equipe somente depois de revisar a
                alteração.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/admin/alunos">Ver Alunos</Link>
              </Button>
              <StaffPromotionDialog />
            </div>
          </div>
          <StaffAccessTable actorUserId={session.user.id} members={members} />
        </section>
      </div>
    </PageContainer>
  );
}
