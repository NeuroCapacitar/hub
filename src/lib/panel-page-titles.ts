export interface PanelBreadcrumb {
  readonly href?: string;
  readonly label: string;
}

export interface PanelRouteMeta {
  readonly ancestors: readonly PanelBreadcrumb[];
  readonly title: string;
}

const PAGE_TITLES: Readonly<Record<string, string>> = {
  "/admin": "Operação diária",
  "/admin/alunos": "Alunos e matrículas",
  "/admin/aprendizagem": "Aprendizagem",
  "/admin/auditoria": "Auditoria administrativa",
  "/admin/configuracoes": "Configurações globais",
  "/admin/configuracoes/design-system": "Sistema visual",
  "/admin/cursos": "Cursos",
  "/admin/equipe": "Equipe",
  "/admin/faq": "Perguntas frequentes",
  "/admin/financeiro": "Financeiro",
  "/admin/operacao": "Operações e recuperação",
  "/admin/operacao/cursos": "Operação de cursos",
  "/app": "Seu espaço de aprendizagem",
  "/app/certificados": "Seus certificados",
  "/app/checkout/sucesso": "Seu acesso está sendo liberado",
  "/app/configuracoes": "Configurações",
  "/app/perguntas-frequentes": "Perguntas frequentes",
};

const TRAILING_SLASHES = /\/+$/;

const DYNAMIC_PAGE_TITLES = [
  [
    /^\/admin\/cursos\/[^/]+\/aulas\/[^/]+$/,
    "Aula",
    [{ href: "/admin/cursos", label: "Cursos" }, { label: "Curso" }],
  ],
  [
    /^\/admin\/cursos\/[^/]+$/,
    "Curso",
    [{ href: "/admin/cursos", label: "Cursos" }],
  ],
  [
    /^\/admin\/operacao\/cursos\/[^/]+\/alunas$/,
    "Alunos",
    [
      { href: "/admin/operacao", label: "Operação" },
      { href: "/admin/operacao/cursos", label: "Cursos" },
      { label: "Curso" },
    ],
  ],
  [
    /^\/app\/aulas\/[^/]+$/,
    "Aula",
    [{ href: "/app", label: "Início" }, { label: "Curso" }],
  ],
  [/^\/app\/cursos\/[^/]+$/, "Curso", [{ href: "/app", label: "Início" }]],
] as const satisfies readonly (readonly [
  RegExp,
  string,
  readonly PanelBreadcrumb[],
])[];

export function getPanelRouteMeta(pathname: string): PanelRouteMeta {
  const normalizedPath = pathname.replace(TRAILING_SLASHES, "") || "/";
  const exactTitle = PAGE_TITLES[normalizedPath];

  if (exactTitle) {
    return { ancestors: [], title: exactTitle };
  }

  for (const [pattern, title, ancestors] of DYNAMIC_PAGE_TITLES) {
    if (pattern.test(normalizedPath)) {
      return { ancestors, title };
    }
  }

  if (normalizedPath.startsWith("/admin")) {
    return { ancestors: [], title: "Administração" };
  }

  if (normalizedPath.startsWith("/app")) {
    return { ancestors: [], title: "Aprendizagem" };
  }

  return { ancestors: [], title: "NeuroCapacitar Hub" };
}

export function getPanelPageTitle(pathname: string): string {
  return getPanelRouteMeta(pathname).title;
}
