import Link from "next/link";
import { FinanceHelp } from "@/components/admin/finance-help";
import { StaffInvitationDialog } from "@/components/admin/staff-invitation-dialog";
import { StaffInvitationList } from "@/components/admin/staff-invitation-list";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getStaffInvitations } from "@/features/admin/staff-invitations";
import { getStaffMembers } from "@/features/admin/staff-server";
import { requirePermission } from "@/lib/auth-permissions";
import { StaffAccessTable } from "./staff-access-table";

export const dynamic = "force-dynamic";

export default async function StaffPage(): Promise<React.JSX.Element> {
  const session = await requirePermission("manageStaffAccess");
  const [members, invitations] = await Promise.all([
    getStaffMembers(),
    getStaffInvitations(),
  ]);

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          actions={
            <>
              <StaffInvitationDialog />
              <Button asChild variant="outline">
                <Link href="/admin/alunos">Ver Alunos</Link>
              </Button>
            </>
          }
          description="Consulte os membros e ajuste as permissões do Suporte."
          title="Equipe"
        />
        <section
          aria-labelledby="staff-invitations-title"
          className="grid gap-4"
        >
          <div>
            <h2 className="type-section-title" id="staff-invitations-title">
              Convites
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              A Conta e o acesso só são criados depois que a pessoa aceita pelo
              e-mail.
            </p>
          </div>
          <StaffInvitationList invitations={invitations} />
        </section>
        <section
          aria-labelledby="staff-table-title"
          className="grid min-w-0 gap-6"
        >
          <div className="flex items-center gap-2">
            <h2 className="type-section-title" id="staff-table-title">
              Contas com acesso administrativo
            </h2>
            <FinanceHelp
              description="Admins têm acesso total. O Suporte combina leituras administrativas padrão com permissões delegáveis."
              details={[
                "Adicione uma conta à equipe somente depois de revisar a alteração.",
              ]}
              title="Permissões da equipe"
            />
          </div>
          <StaffAccessTable actorUserId={session.user.id} members={members} />
        </section>
      </div>
    </PageContainer>
  );
}
