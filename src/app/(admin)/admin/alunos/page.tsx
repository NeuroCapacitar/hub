import {
  Time02Icon,
  UserBlock01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { FinanceHelp } from "@/components/admin/finance-help";
import type { StudentManagementCapabilities } from "@/components/admin/student-management-types";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { getAdminStudentsData } from "@/features/admin/server";
import { parseAdminStudentAccessFilter } from "@/features/admin/student-filters";
import { requirePermission } from "@/lib/auth-permissions";
import { canPerform } from "@/lib/auth-policy";
import { AdminMetricCard } from "../admin-metric-card";
import { StudentsTable, type StudentTableRow } from "./students-table";
import { createGlobalStudentsTableContext } from "./students-table-context";

export const dynamic = "force-dynamic";

interface AdminStudentsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const firstSearchParam = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

const formatCount = (value: number): string => value.toLocaleString("pt-BR");

export default async function AdminStudentsPage({
  searchParams,
}: AdminStudentsPageProps): Promise<React.JSX.Element> {
  const session = await requirePermission("viewStudents");
  const params = (await searchParams) ?? {};
  const page = Number.parseInt(firstSearchParam(params.page) ?? "1", 10);
  const search = firstSearchParam(params.q)?.trim() ?? "";
  const accessFilter = parseAdminStudentAccessFilter(
    firstSearchParam(params.access)
  );
  const data = await getAdminStudentsData({
    ...(accessFilter === "all" ? {} : { access: accessFilter }),
    page: Number.isFinite(page) ? page : 1,
    ...(search ? { search } : {}),
  });
  const managementCapabilities: StudentManagementCapabilities = {
    canManageCertificates: canPerform(session, "manageCertificates"),
    canManageEnrollmentAccess: canPerform(session, "manageEnrollmentAccess"),
    canManageEnrollmentSupport: canPerform(session, "manageEnrollmentSupport"),
    canManagePlatformAccess: canPerform(session, "manageEnrollmentAccess"),
    canReissueCertificates: canPerform(session, "reissueCertificates"),
  };

  const students: StudentTableRow[] = data.students.map((student) => ({
    email: student.email,
    lastAccessAt: student.lastAccessAt?.toISOString() ?? null,
    name: student.name,
    platformBlockedAt: student.platformBlockedAt?.toISOString() ?? null,
    platformBlockedReason: student.platformBlockedReason,
    status: student.status,
    userId: student.userId,
  }));

  return (
    <PageContainer>
      <div className="flex flex-col gap-16">
        <PageHeader title="Alunos e matrículas" />

        <section aria-labelledby="students-summary-title">
          <div className="mb-6 flex items-center gap-1">
            <h2 className="type-section-title" id="students-summary-title">
              Resumo de acesso
            </h2>
            <FinanceHelp
              description="Este resumo é global e não muda quando a tabela é pesquisada ou paginada."
              details={[
                "Acesso ativo considera uma Matrícula vigente em um Curso ativo e publicado, com a plataforma desbloqueada.",
                "Sem acesso ativo inclui Alunos sem Matrícula efetiva ou com o acesso geral bloqueado.",
                "Expirando em breve considera o próximo acesso efetivo que termina nos próximos 30 dias.",
              ]}
              title="Resumo de acesso"
            />
          </div>
          <div className="grid gap-x-4 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              helper="Global; não muda com busca ou página."
              icon={UserGroupIcon}
              label="Alunos cadastrados"
              value={formatCount(data.accessSummary.totalStudents)}
            />
            <AdminMetricCard
              helper="Matrícula efetiva em Curso publicado."
              icon={UserCircleIcon}
              label="Com acesso ativo"
              value={formatCount(data.accessSummary.activeStudents)}
            />
            <AdminMetricCard
              helper="Sem Matrícula efetiva ou plataforma bloqueada."
              icon={UserBlock01Icon}
              label="Sem acesso ativo"
              value={formatCount(
                data.accessSummary.withoutActiveAccessStudents
              )}
            />
            <AdminMetricCard
              helper="Próximo acesso vence em até 30 dias."
              icon={Time02Icon}
              label="Expirando em breve"
              value={formatCount(data.accessSummary.expiringSoonStudents)}
            />
          </div>
        </section>

        <section
          aria-labelledby="students-table-title"
          className="grid min-w-0 gap-6"
        >
          <div>
            <div>
              <div className="flex items-center gap-1">
                <h2 className="type-section-title" id="students-table-title">
                  Alunos cadastrados
                </h2>
                <FinanceHelp
                  description="Cada linha representa um Aluno. O menu de ações separa consulta, detalhes e operação da plataforma."
                  details={[
                    "A coluna Acesso mostra o estado agregado da plataforma e das Matrículas efetivas.",
                    "Último acesso mostra o registro mais recente da plataforma; quando não há registro, isso é indicado na linha.",
                    "Cursos, certificados e detalhes ficam na consulta; o menu de ações contém somente operações da plataforma.",
                  ]}
                  title="Lista de Alunos"
                />
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                Busque por nome ou e-mail, filtre o estado do acesso e use o
                menu de ações para consultar ou operar a plataforma.
              </p>
            </div>
          </div>
          <StudentsTable
            context={createGlobalStudentsTableContext(accessFilter)}
            hasNextPage={data.hasNextPage}
            managementCapabilities={managementCapabilities}
            page={data.page}
            pageSize={data.pageSize}
            search={data.search}
            students={students}
            totalCount={data.totalCount}
          />
        </section>
      </div>
    </PageContainer>
  );
}
