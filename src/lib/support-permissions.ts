export const DELEGABLE_SUPPORT_VIEWS = [
  "viewFinancialAnalysis",
  "viewFinancialOrders",
  "viewFinancialReviews",
  "viewAudit",
] as const;

export type SupportViewPermission = (typeof DELEGABLE_SUPPORT_VIEWS)[number];

export const DELEGABLE_SUPPORT_PERMISSIONS = [
  "createCourse",
  "manageCourseDetails",
  "manageCourseContent",
  "manageCourseAvailability",
  "manageCourseCertificate",
  "manageEnrollmentSupport",
  "manageEnrollmentAccess",
  "reissueCertificates",
  "manageCertificateIssuerProfile",
  "executeRefund",
  "manageFinancialOperations",
  "manageFinancialReviews",
  "manageOperations",
] as const;

export type SupportPermission = (typeof DELEGABLE_SUPPORT_PERMISSIONS)[number];
export type SupportPermissionKey = SupportPermission | SupportViewPermission;

const delegableSupportPermissionSet = new Set<string>(
  DELEGABLE_SUPPORT_PERMISSIONS
);
const delegableSupportViewSet = new Set<string>(DELEGABLE_SUPPORT_VIEWS);

export interface SupportPermissionDefinition {
  description: string;
  key: SupportPermissionKey;
  kind: "change" | "view";
  label: string;
}

export interface SupportPermissionGroup {
  label: string;
  permissions: readonly SupportPermissionDefinition[];
}

export const SUPPORT_PERMISSION_VIEW_REQUIREMENTS: Readonly<
  Partial<Record<SupportPermission, readonly SupportViewPermission[]>>
> = {
  executeRefund: ["viewFinancialOrders"],
  manageFinancialOperations: ["viewFinancialOrders"],
  manageFinancialReviews: ["viewFinancialReviews"],
};

export const SUPPORT_PERMISSION_GROUPS: readonly SupportPermissionGroup[] = [
  {
    label: "Cursos",
    permissions: [
      {
        description: "Criar Cursos no catálogo administrativo.",
        key: "createCourse",
        kind: "change",
        label: "Criar Cursos",
      },
      {
        description:
          "Alterar dados gerais do Curso, sem disponibilidade e vendas.",
        key: "manageCourseDetails",
        kind: "change",
        label: "Alterar dados do Curso",
      },
      {
        description: "Criar, editar, ordenar e publicar conteúdo curricular.",
        key: "manageCourseContent",
        kind: "change",
        label: "Alterar conteúdo",
      },
      {
        description: "Alterar visibilidade, entrega e estado de vendas.",
        key: "manageCourseAvailability",
        kind: "change",
        label: "Alterar disponibilidade e vendas",
      },
      {
        description: "Alterar o modelo de Certificado do Curso.",
        key: "manageCourseCertificate",
        kind: "change",
        label: "Alterar Certificado",
      },
    ],
  },
  {
    label: "Alunos",
    permissions: [
      {
        description: "Ajustar validade, bloqueio e restauração de Matrículas.",
        key: "manageEnrollmentSupport",
        kind: "change",
        label: "Gerenciar Matrículas",
      },
      {
        description: "Conceder ou revogar acessos de maior impacto.",
        key: "manageEnrollmentAccess",
        kind: "change",
        label: "Operar acesso da plataforma",
      },
      {
        description: "Reemitir o Certificado mais recente de um Aluno.",
        key: "reissueCertificates",
        kind: "change",
        label: "Reemitir Certificados",
      },
    ],
  },
  {
    label: "Financeiro",
    permissions: [
      {
        description: "Consultar análise e indicadores financeiros.",
        key: "viewFinancialAnalysis",
        kind: "view",
        label: "Ver análise financeira",
      },
      {
        description: "Consultar pedidos, detalhes e estados financeiros.",
        key: "viewFinancialOrders",
        kind: "view",
        label: "Ver pedidos",
      },
      {
        description: "Consultar a fila de revisões financeiras.",
        key: "viewFinancialReviews",
        kind: "view",
        label: "Ver revisões financeiras",
      },
      {
        description: "Solicitar reembolsos integrais com confirmação.",
        key: "executeRefund",
        kind: "change",
        label: "Realizar Reembolsos",
      },
      {
        description: "Conciliar pagamentos e importar movimentações.",
        key: "manageFinancialOperations",
        kind: "change",
        label: "Operar Financeiro",
      },
      {
        description: "Registrar decisões em revisões financeiras.",
        key: "manageFinancialReviews",
        kind: "change",
        label: "Resolver Revisões",
      },
    ],
  },
  {
    label: "Operação",
    permissions: [
      {
        description: "Recuperar filas, integrações e pendências técnicas.",
        key: "manageOperations",
        kind: "change",
        label: "Operar Operação",
      },
    ],
  },
  {
    label: "Auditoria",
    permissions: [
      {
        description: "Consultar os eventos administrativos permitidos.",
        key: "viewAudit",
        kind: "view",
        label: "Ver Auditoria",
      },
    ],
  },
  {
    label: "Configurações",
    permissions: [
      {
        description:
          "Alterar o perfil e a assinatura globais usados em novos Certificados.",
        key: "manageCertificateIssuerProfile",
        kind: "change",
        label: "Alterar perfil e assinatura de Certificados",
      },
    ],
  },
] as const;

export const isDelegableSupportPermission = (
  value: unknown
): value is SupportPermission =>
  typeof value === "string" && delegableSupportPermissionSet.has(value);

export const isDelegableSupportView = (
  value: unknown
): value is SupportViewPermission =>
  typeof value === "string" && delegableSupportViewSet.has(value);

export const normalizeSupportPermissionGrants = (
  values: unknown
): SupportPermission[] => {
  const selected = new Set(
    (Array.isArray(values) ? values : []).filter(isDelegableSupportPermission)
  );

  return DELEGABLE_SUPPORT_PERMISSIONS.filter((permission) =>
    selected.has(permission)
  );
};

export const parseSupportPermissionGrants = (
  value: unknown
): SupportPermission[] => {
  if (!Array.isArray(value)) {
    throw new Error("As permissões do Suporte devem ser uma lista.");
  }

  if (value.some((permission) => !isDelegableSupportPermission(permission))) {
    throw new Error("A lista contém uma permissão de Suporte inválida.");
  }

  return normalizeSupportPermissionGrants(value);
};

export const normalizeSupportPermissionViews = (
  values: unknown
): SupportViewPermission[] => {
  const selected = new Set(
    (Array.isArray(values) ? values : []).filter(isDelegableSupportView)
  );

  return DELEGABLE_SUPPORT_VIEWS.filter((permission) =>
    selected.has(permission)
  );
};

export const parseSupportPermissionViews = (
  value: unknown
): SupportViewPermission[] => {
  if (!Array.isArray(value)) {
    throw new Error("As visualizações do Suporte devem ser uma lista.");
  }

  if (value.some((permission) => !isDelegableSupportView(permission))) {
    throw new Error("A lista contém uma visualização de Suporte inválida.");
  }

  return normalizeSupportPermissionViews(value);
};
