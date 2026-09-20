// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/admin/actions", () => ({
  adjustEnrollmentExpirationAction: vi.fn(),
  blockEnrollmentAccessAction: vi.fn(),
  blockStudentPlatformAccessAction: vi.fn(),
  restoreEnrollmentAccessAction: vi.fn(),
  restoreStudentPlatformAccessAction: vi.fn(),
}));
vi.mock("@/features/admin/staff-actions", () => ({
  changeStaffAccessAction: vi.fn(),
}));
vi.mock("@/features/certificates/actions", () => ({
  issueManualCertificateAction: vi.fn(),
  reissueCertificateAction: vi.fn(),
  revokeCertificateAction: vi.fn(),
}));

import { StudentsTable, type StudentTableRow } from "./students-table";
import {
  createCourseStudentsTableContext,
  createGlobalStudentsTableContext,
} from "./students-table-context";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const student: StudentTableRow = {
  email: "student@example.test",
  lastAccessAt: null,
  name: "Student",
  platformBlockedAt: null,
  platformBlockedReason: null,
  status: "active",
  userId: "student-1",
};

const createStudentPayload = (courseId: string | null) => ({
  certificates: [],
  context: {
    courseId,
    courseTitle: courseId ? "Curso 1" : null,
  },
  student: {
    email: student.email,
    enrollments: courseId
      ? [
          {
            courseId,
            courseTitle: "Curso 1",
            expiresAt: "2027-01-01T00:00:00.000Z",
            id: "enrollment-1",
            originalExpiresAt: "2027-01-01T00:00:00.000Z",
            revokedReason: null,
            startedAt: "2026-01-01T00:00:00.000Z",
            status: "active",
            userId: student.userId,
          },
        ]
      : [],
    name: student.name,
    platformBlockedAt: null,
    platformBlockedReason: null,
    userId: student.userId,
  },
});

let root: Root | null = null;
let container: HTMLDivElement;

const clickActionMenu = async (): Promise<void> => {
  await act(async () => {
    const trigger = document.querySelector(
      'button[aria-label="Abrir ficha de Student"]'
    ) as HTMLButtonElement | null;
    trigger?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  vi.restoreAllMocks();
});

describe("StudentsTable action scope", () => {
  it("opens the global student sheet with a direct action", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createGlobalStudentsTableContext()}
          students={[student]}
        />
      );
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createStudentPayload(null)), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await clickActionMenu();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/students/student-1",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(document.body.textContent).toContain("Acesso na plataforma");
    expect(document.body.textContent).toContain("Gerenciar acesso");
    expect(document.body.textContent).not.toContain("Motivo do bloqueio");
  });

  it("keeps platform actions inside a separate dialog trigger", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createGlobalStudentsTableContext()}
          students={[student]}
        />
      );
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createStudentPayload(null)), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await clickActionMenu();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/students/student-1",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(document.body.textContent).toContain("Cursos do Aluno");
    expect(document.body.textContent).toContain("Gerenciar acesso");
    expect(document.body.textContent).not.toContain("Motivo do bloqueio");
    expect(document.body.textContent).not.toContain("Ações da Matrícula");
  });

  it("opens course operations inside the student sheet", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createCourseStudentsTableContext("course-1")}
          students={[student]}
        />
      );
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createStudentPayload("course-1")), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    await clickActionMenu();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/students/student-1?courseId=course-1",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(document.body.textContent).toContain("Gerenciar este Curso");
    expect(document.body.textContent).toContain("Gerenciar matrícula");
    expect(document.body.textContent).toContain("Gerenciar certificados");
    expect(document.body.textContent).not.toContain("Ações da Matrícula");
    expect(document.body.textContent).not.toContain("Ajustar validade");
    expect(document.body.textContent).not.toContain("Bloquear acesso ao Curso");
    expect(
      document.body.textContent?.match(/Expiração original/g)
    ).toHaveLength(1);
    expect(document.body.textContent).not.toContain("Acesso na plataforma");
  });

  it("does not advertise platform mutations to read-only operators", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createGlobalStudentsTableContext()}
          managementCapabilities={{
            canManageCertificates: false,
            canManageEnrollmentAccess: false,
            canManageEnrollmentSupport: false,
            canManagePlatformAccess: false,
            canReissueCertificates: false,
          }}
          students={[student]}
        />
      );
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(createStudentPayload(null)), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        })
      )
    );
    await clickActionMenu();

    expect(document.body.textContent).toContain("Acesso na plataforma");
    expect(document.body.textContent).not.toContain(
      "Bloquear acesso da plataforma"
    );
  });

  it("does not expose staff promotion from the student sheet", async () => {
    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createGlobalStudentsTableContext()}
          managementCapabilities={{
            canManageCertificates: false,
            canManageEnrollmentAccess: false,
            canManageEnrollmentSupport: false,
            canManagePlatformAccess: false,
            canReissueCertificates: false,
          }}
          students={[student]}
        />
      );
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(createStudentPayload(null)), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        })
      )
    );
    await clickActionMenu();

    expect(document.body.textContent).not.toContain("Promover para equipe");
  });

  it("opens the selected course enrollment after contextual navigation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createStudentPayload("course-1")), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    root = createRoot(container);
    act(() => {
      root?.render(
        <StudentsTable
          context={createCourseStudentsTableContext("course-1")}
          initialStudentId="student-1"
          students={[student]}
        />
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/students/student-1?courseId=course-1",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(document.body.textContent).toContain("Detalhes da matrícula");
    expect(document.body.textContent).toContain("Gerenciar este Curso");
    expect(document.body.textContent).toContain("Gerenciar matrícula");
    expect(document.body.textContent).not.toContain("Ações da Matrícula");
  });
});
