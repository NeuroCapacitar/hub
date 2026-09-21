import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CertificateRecord } from "@/features/certificates/server";

const dependencies = vi.hoisted(() => ({
  getCertificatesForUser: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/features/certificates/server", () => ({
  getCertificatesForUser: dependencies.getCertificatesForUser,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));
vi.mock("./certificate-card", () => ({
  CertificateCard: ({ certificate }: { certificate: CertificateRecord }) => (
    <article data-certificate-code={certificate.code}>
      {certificate.courseTitle}
    </article>
  ),
}));
vi.mock("./certificate-history-sheet", () => ({
  CertificateHistorySheet: ({
    certificateCount,
    children,
  }: {
    certificateCount: number;
    children: React.ReactNode;
  }) => (
    <div data-history-count={certificateCount}>
      <button type="button">Histórico ({certificateCount})</button>
      {children}
    </div>
  ),
}));
vi.mock("./pending-certificate-refresh", () => ({
  PendingCertificateRefresh: () => null,
}));

import MyCertificatesPage from "./page";

const readyCertificate: CertificateRecord = {
  code: "CERT-001",
  courseTitle: "Curso de teste",
  issuedAt: new Date("2026-07-20T12:00:00.000Z"),
  renderStatus: "ready",
  revokedAt: null,
  revokedReasonCategory: null,
  status: "valid",
  studentName: "Maria Silva",
  workloadHours: 12,
};

const revokedCertificate: CertificateRecord = {
  ...readyCertificate,
  code: "CERT-REVOKED",
  courseTitle: "Curso revogado",
  revokedAt: new Date("2026-07-22T12:00:00.000Z"),
  revokedReasonCategory: "integrity_review",
  status: "revoked",
};

const renderPage = async (
  certificates: CertificateRecord[]
): Promise<string> => {
  dependencies.getCertificatesForUser.mockResolvedValue(certificates);
  return renderToStaticMarkup(await MyCertificatesPage());
};

describe("MyCertificatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
  });

  it("renders the certificate library without decorative metrics", async () => {
    const markup = await renderPage([readyCertificate]);

    expect(markup).toContain("Curso de teste");
    expect(markup).toContain("Suas conquistas");
    expect(markup).toContain("Cada certificado guarda um passo");
    expect(markup).toContain('data-certificate-code="CERT-001"');
    expect(markup).not.toContain("Emitidos");
    expect(markup).not.toContain("Validação</p>");
    expect(markup).not.toContain(">QR<");
  });

  it("preserves the empty state and course navigation", async () => {
    const markup = await renderPage([]);

    expect(markup).toContain("Seu primeiro certificado começa aqui");
    expect(markup).toContain("Conclua as aulas obrigatórias");
    expect(markup).not.toContain("Conclua 100% das aulas");
    expect(markup).toContain('href="/app"');
    expect(markup).toContain("Voltar para meus cursos");
  });

  it("keeps revoked certificates in a separate history section", async () => {
    const markup = await renderPage([readyCertificate, revokedCertificate]);

    expect(markup).toContain("Curso de teste");
    expect(markup).toContain('data-history-count="1"');
    expect(markup).toContain("Histórico (1)");
    expect(markup).toContain("Curso revogado");
    expect(markup).toContain("CERT-REVOKED");
  });
});
