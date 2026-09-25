import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAdminCourseTabData: vi.fn(),
  getAdminCourseContentSignal: vi.fn(),
  getAdminCourseOperationalState: vi.fn(),
  getCertificateTemplatesForCourse: vi.fn(),
  getCertificateIssuerProfileForPreview: vi.fn(),
  getServerEnv: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/features/admin/actions", () => ({
  createLessonAction: vi.fn(),
  createModuleAction: vi.fn(),
  deleteLessonAction: vi.fn(),
  deleteModuleAction: vi.fn(),
  reorderLessonsAction: vi.fn(),
  reorderModulesAction: vi.fn(),
  saveLessonAction: vi.fn(),
  saveModuleAction: vi.fn(),
}));
vi.mock("@/features/admin/presentation", () => ({
  getAdminCourseContentSignal: dependencies.getAdminCourseContentSignal,
  getAdminCourseOperationalState: dependencies.getAdminCourseOperationalState,
  summarizeAdminCourseContent: () => ({
    draftLessons: 1,
    emptyModules: 0,
    publishedLessons: 5,
    readyLessons: 6,
    totalDurationSeconds: 7500,
    totalLessons: 6,
    withoutContentLessons: 0,
  }),
}));
vi.mock("@/features/admin/server", () => ({
  getAdminCourseTabData: dependencies.getAdminCourseTabData,
}));
vi.mock("@/features/certificates/templates", () => ({
  getCertificateTemplatesForCourse:
    dependencies.getCertificateTemplatesForCourse,
  getCertificateIssuerProfileForPreview:
    dependencies.getCertificateIssuerProfileForPreview,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("@/lib/auth-policy", () => ({ canPerform: () => true }));
vi.mock("./certificate-template-editor", () => ({
  CertificateTemplateEditor: ({
    courseTitle,
    courseWorkloadHours,
    issuerCnpj,
    issuerConfigured,
    issuerDisplayName,
    pendingCertificateReconciliationCount,
  }: {
    courseTitle: string;
    courseWorkloadHours: number;
    issuerCnpj: string | null;
    issuerConfigured: boolean;
    issuerDisplayName: string | null;
    pendingCertificateReconciliationCount: number;
  }) => (
    <div
      data-course-title={courseTitle}
      data-course-workload-hours={courseWorkloadHours}
      data-issuer-cnpj={issuerCnpj}
      data-issuer-configured={issuerConfigured}
      data-issuer-display-name={issuerDisplayName}
      data-pending-certificate-reconciliation={
        pendingCertificateReconciliationCount
      }
    />
  ),
}));
vi.mock("./course-builder-components", () => ({
  CourseBuilderWrapper: () => null,
  CreateModuleDialog: () => null,
}));
vi.mock("./course-content-panel", () => ({
  CourseContentPanel: ({
    contentSignal,
    course: contentCourse,
    lessons,
    modules,
    nextModuleSortOrder,
    publicationState,
  }: {
    contentSignal: { label: string };
    course: { id: string };
    lessons: unknown[];
    modules: unknown[];
    nextModuleSortOrder: number;
    publicationState: { hasDraft: boolean; hasPublished: boolean };
  }) => (
    <div
      data-content-signal={contentSignal.label}
      data-course-content-panel="true"
      data-course-id={contentCourse.id}
      data-has-draft={publicationState.hasDraft}
      data-has-published={publicationState.hasPublished}
      data-lesson-count={lessons.length}
      data-module-count={modules.length}
      data-next-module-sort-order={nextModuleSortOrder}
    />
  ),
}));
vi.mock("./course-dialogs-client", () => ({
  CourseSettingsForm: () => (
    <div data-course-settings-form="true">
      settings-form <span>Disponibilidade</span>
    </div>
  ),
}));
vi.mock("./course-enrollments-table", () => ({
  CourseEnrollmentsTable: () => null,
}));
vi.mock("./course-management-tabs", () => ({
  useCourseTabDirty: vi.fn(),
  CourseManagementTabs: ({
    certificate,
    content,
    overview,
    settings,
    students,
  }: {
    certificate?: ReactNode;
    content?: ReactNode;
    overview?: ReactNode;
    settings?: ReactNode;
    students?: ReactNode;
  }) => (
    <div data-course-management-tabs="true">
      {overview ? <div data-course-panel="overview">{overview}</div> : null}
      {content ? <div data-course-panel="content">{content}</div> : null}
      {students ? <div data-course-panel="students">{students}</div> : null}
      {settings ? <div data-course-panel="settings">{settings}</div> : null}
      {certificate ? (
        <div data-course-panel="certificate">{certificate}</div>
      ) : null}
    </div>
  ),
}));
vi.mock("./course-overview", () => ({
  CourseOverview: ({
    courseAvailability,
    contentSummary,
    courseId,
    durationSeconds,
    moduleCount,
    operationalState,
    overviewSummary,
    publicationState,
    previewHref,
  }: {
    courseAvailability: { label: string; variant: string };
    contentSummary: { totalLessons: number };
    courseId: string;
    durationSeconds: number;
    moduleCount: number;
    operationalState: { key: string };
    overviewSummary: {
      activeEnrollmentCount: number;
      paidOrderCount: number;
      validCertificateCount: number;
    };
    publicationState: { hasDraft: boolean; hasPublished: boolean };
    previewHref: string;
  }) => (
    <div
      data-active-enrollments={overviewSummary.activeEnrollmentCount}
      data-course-availability={courseAvailability.label}
      data-course-id={courseId}
      data-course-overview="true"
      data-duration-seconds={durationSeconds}
      data-has-draft={publicationState.hasDraft}
      data-has-published={publicationState.hasPublished}
      data-module-count={moduleCount}
      data-operational-state={operationalState.key}
      data-paid-orders={overviewSummary.paidOrderCount}
      data-total-lessons={contentSummary.totalLessons}
      data-valid-certificates={overviewSummary.validCertificateCount}
    >
      <span>{courseAvailability.label}</span>
      <a href={previewHref}>Ver como aluno</a>
    </div>
  ),
}));
vi.mock("./course-purchase-link", () => ({
  CoursePurchaseLink: ({
    link,
  }: {
    link:
      | { available: true; url: string }
      | { available: false; reason: string };
  }) => (
    <div
      data-purchase-link={
        link.available ? link.url : `unavailable:${link.reason}`
      }
    />
  ),
}));
vi.mock("./course-availability-form", () => ({
  CourseRiskZone: () => (
    <div data-course-risk-zone="true">
      <button type="button">Arquivar curso</button>
    </div>
  ),
}));

import AdminCourseDetailPage from "./page";

const course = {
  accessDurationMonths: 12,
  catalogVisibility: "listed",
  certificateEnabled: false,
  coverImage: null,
  description: "Descricao",
  id: "course-1",
  interestCount: 0,
  interestNotificationsSent: 0,
  launchDate: null,
  launchLandingUrl: null,
  paymentAllowCreditCard: true,
  paymentAllowPix: true,
  paymentMaxInstallmentCount: 3,
  pendingCheckoutCancellations: 0,
  pendingCertificateReconciliationCount: 7,
  pendingInterestNotifications: 0,
  priceInCents: 10_000,
  salesStatus: "open",
  slug: "curso-publico",
  status: "active",
  thumbnailUrl: null,
  title: "Curso publico",
  workloadHours: 2,
  workloadHoursOverride: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.requirePermission.mockResolvedValue({
    role: "admin",
    supportPermissionGrants: [],
  });
  dependencies.getAdminCourseTabData.mockResolvedValue({
    tab: "overview",
    course,
    lessons: [],
    modules: [],
    overviewSummary: {
      activeEnrollmentCount: 57,
      paidOrderCount: 83,
      validCertificateCount: 41,
    },
    publicationState: { hasDraft: false, hasPublished: true },
  });
  dependencies.getAdminCourseContentSignal.mockReturnValue({
    helper: "A estrutura curricular está pronta para revisão.",
    label: "Conteúdo pronto",
    tone: "healthy",
  });
  dependencies.getCertificateTemplatesForCourse.mockResolvedValue([]);
  dependencies.getAdminCourseOperationalState.mockReturnValue({
    actionLabel: null,
    actionTab: null,
    description: "Curso disponível.",
    key: "ready",
    label: "Curso publicado",
    tone: "healthy",
  });
  dependencies.getCertificateIssuerProfileForPreview.mockResolvedValue({
    cnpj: null,
    configured: false,
    displayName: null,
  });
  dependencies.getServerEnv.mockReturnValue({
    NEXT_PUBLIC_APP_URL: "https://hub.example/base",
    PAYMENTS_CHECKOUT_MODE: "public",
  });
});

describe("AdminCourseDetailPage overview", () => {
  it("passes exact aggregate counts to the dedicated overview", async () => {
    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );

    expect(dependencies.getAdminCourseTabData).toHaveBeenCalledWith({
      courseId: course.id,
      enrollmentQuery: { page: 1, search: "" },
      tab: "overview",
    });
    expect(markup).toContain('data-course-overview="true"');
    expect(markup).toContain('data-active-enrollments="57"');
    expect(markup).toContain('data-paid-orders="83"');
    expect(markup).toContain('data-valid-certificates="41"');
    expect(markup).not.toContain('data-pending-certificate-reconciliation="7"');
    expect(markup).toContain('data-module-count="0"');
    expect(markup).toContain('data-total-lessons="6"');
    expect(markup).toContain('data-duration-seconds="7500"');
    expect(markup).toContain('data-has-published="true"');
    expect(markup).toContain('data-has-draft="false"');
  });

  it("passes enrollment search and page to the server projection", async () => {
    await AdminCourseDetailPage({
      params: Promise.resolve({ courseId: course.id }),
      searchParams: Promise.resolve({
        enrollmentPage: "2",
        enrollmentQ: "student",
        tab: "students",
      }),
    });

    expect(dependencies.getAdminCourseTabData).toHaveBeenCalledWith({
      courseId: course.id,
      enrollmentQuery: { page: 2, search: "student" },
      tab: "students",
    });
  });

  it("passes the selected student context for contextual management", async () => {
    await AdminCourseDetailPage({
      params: Promise.resolve({ courseId: course.id }),
      searchParams: Promise.resolve({
        enrollmentAction: "certificate",
        enrollmentStudentId: "student-1",
        tab: "students",
      }),
    });

    expect(dependencies.getAdminCourseTabData).toHaveBeenCalledWith({
      courseId: course.id,
      enrollmentQuery: {
        page: 1,
        search: "",
        studentId: "student-1",
      },
      tab: "students",
    });
  });

  it("derives the operational state from the real course signals", async () => {
    const purchaseLink = {
      available: true as const,
      url: "https://hub.example/comprar/curso-publico",
    };

    await AdminCourseDetailPage({
      params: Promise.resolve({ courseId: course.id }),
    });

    expect(dependencies.getAdminCourseOperationalState).toHaveBeenCalledWith({
      hasDescription: true,
      hasDraft: false,
      hasPublished: true,
      hasReadyLesson: true,
      hasThumbnail: false,
      moduleCount: 0,
      purchaseLink,
      status: "active",
    });
  });

  it("renders only the active panel in the navigation shell", async () => {
    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );

    expect(markup).toContain('data-course-management-tabs="true"');
    expect(markup.match(/data-course-panel=/g)).toHaveLength(1);
    expect(markup).toContain('data-course-panel="overview"');
    expect(markup).not.toContain('data-course-panel="content"');
    expect(markup).not.toContain('data-course-panel="students"');
    expect(markup).not.toContain('data-course-panel="settings"');
    expect(markup).not.toContain('data-course-panel="certificate"');
  });
});

describe("AdminCourseDetailPage certificate", () => {
  it("passes the effective workload to the certificate preview", async () => {
    dependencies.getCertificateIssuerProfileForPreview.mockResolvedValueOnce({
      cnpj: "04.252.011/0001-10",
      configured: true,
      displayName: "Instituto Protea Educação Profissional",
    });
    dependencies.getAdminCourseTabData.mockResolvedValue({
      tab: "certificate",
      course: {
        ...course,
        workloadHours: 10,
        workloadHoursOverride: 20,
      },
      lessons: [],
      modules: [],
      overviewSummary: {
        activeEnrollmentCount: 0,
        paidOrderCount: 0,
        validCertificateCount: 0,
      },
      publicationState: { hasDraft: false, hasPublished: true },
    });

    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
        searchParams: Promise.resolve({ tab: "certificate" }),
      })
    );

    expect(markup).toContain('data-course-workload-hours="20"');
    expect(markup).toContain('data-course-title="Curso publico"');
    expect(markup).toContain('data-issuer-configured="true"');
    expect(markup).toContain('data-issuer-cnpj="04.252.011/0001-10"');
    expect(markup).toContain(
      'data-issuer-display-name="Instituto Protea Educação Profissional"'
    );
  });
});

describe("AdminCourseDetailPage header", () => {
  it.each([
    [{ status: "active" }, "Disponível"],
    [
      { catalogVisibility: "listed", salesStatus: "closed", status: "draft" },
      "Em breve",
    ],
    [{ salesStatus: "closed", status: "active" }, "Vendas pausadas"],
    [
      { catalogVisibility: "hidden", salesStatus: "closed", status: "draft" },
      "Rascunho",
    ],
    [
      {
        catalogVisibility: "hidden",
        salesStatus: "closed",
        status: "archived",
      },
      "Arquivado",
    ],
  ])("localizes Course availability as %s", async (overrides, label) => {
    dependencies.getAdminCourseTabData.mockResolvedValue({
      tab: "overview",
      course: { ...course, ...overrides },
      lessons: [],
      modules: [],
      overviewSummary: {
        activeEnrollmentCount: 0,
        paidOrderCount: 0,
        validCertificateCount: 0,
      },
      publicationState: { hasDraft: false, hasPublished: true },
    });

    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );

    expect(markup).toContain(`>${label}<`);
  });

  it("keeps preview with the course tab navigation", async () => {
    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );
    expect(markup).toContain("Ver como aluno");
    expect(markup).toContain(`/app/cursos/${course.id}?preview=student`);
    expect(markup).not.toContain("Preparar alterações");
    expect(markup).not.toContain("Publicar alterações");
    expect(markup).not.toContain(">Conteúdo pronto<");
  });
});

describe("AdminCourseDetailPage content", () => {
  it("orchestrates the dedicated content panel with derived publication data", async () => {
    dependencies.getAdminCourseTabData.mockResolvedValue({
      tab: "content",
      course,
      lessons: [{ id: "lesson-1" }],
      modules: [
        { id: "module-3", sortOrder: 3 },
        { id: "module-1", sortOrder: 1 },
      ],
      publicationState: {
        hasDraft: true,
        hasPublished: true,
      },
    });

    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
        searchParams: Promise.resolve({ tab: "content" }),
      })
    );

    expect(dependencies.getAdminCourseContentSignal).toHaveBeenCalledWith({
      draftLessons: 1,
      emptyModules: 0,
      publishedLessons: 5,
      readyLessons: 6,
      totalDurationSeconds: 7500,
      totalLessons: 6,
      withoutContentLessons: 0,
    });
    expect(markup).toContain('data-course-content-panel="true"');
    expect(markup).toContain('data-course-id="course-1"');
    expect(markup).toContain('data-module-count="2"');
    expect(markup).toContain('data-lesson-count="1"');
    expect(markup).toContain('data-next-module-sort-order="4"');
    expect(markup).toContain('data-has-draft="true"');
    expect(markup).toContain('data-has-published="true"');
    expect(markup).toContain('data-content-signal="Conteúdo pronto"');
  });
});

describe("AdminCourseDetailPage purchase link", () => {
  it("derives the stable public link from the single publication projection", async () => {
    dependencies.getAdminCourseTabData.mockResolvedValue({
      course,
      publicationState: { hasDraft: false, hasPublished: true },
      tab: "settings",
    });
    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
        searchParams: Promise.resolve({ tab: "settings" }),
      })
    );

    expect(dependencies.getAdminCourseTabData).toHaveBeenCalledWith({
      courseId: course.id,
      enrollmentQuery: { page: 1, search: "" },
      tab: "settings",
    });
    expect(markup).toContain(
      'data-purchase-link="https://hub.example/comprar/curso-publico"'
    );
    expect(markup.match(/data-slot="card"/g)).toHaveLength(2);
    expect(markup).toContain("Disponibilidade");
    expect(markup).toContain("Configurações do curso");
    expect(markup).not.toContain("Responsável pelo certificado");
    expect(markup).toContain('data-course-risk-zone="true"');
    expect(markup).toContain("bg-destructive/10");
    expect(markup).toContain("sm:flex-row");
    expect(markup.indexOf("Configurações do curso")).toBeLessThan(
      markup.indexOf("Disponibilidade")
    );
    expect(markup.indexOf("Disponibilidade")).toBeLessThan(
      markup.indexOf("Zona de risco")
    );
    expect(markup.indexOf("Arquivar interrompe vendas")).toBeLessThan(
      markup.indexOf("Arquivar curso")
    );
  });

  it("passes an unavailable state instead of a false link for an unpublished course", async () => {
    dependencies.getAdminCourseTabData.mockResolvedValue({
      course,
      publicationState: { hasDraft: true, hasPublished: false },
      tab: "settings",
    });

    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
        searchParams: Promise.resolve({ tab: "settings" }),
      })
    );

    expect(dependencies.getAdminCourseTabData).toHaveBeenCalledWith({
      courseId: course.id,
      enrollmentQuery: { page: 1, search: "" },
      tab: "settings",
    });
    expect(markup).toContain(
      'data-purchase-link="unavailable:course_unpublished"'
    );
    expect(markup).not.toContain("https://hub.example/comprar/curso-publico");
  });
});
