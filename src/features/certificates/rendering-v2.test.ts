import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { CertificateRenderSnapshot } from "./render-snapshot";
import { renderCertificatePdf } from "./rendering";

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

const snapshot: CertificateRenderSnapshot = {
  certificate: {
    code: "PRT-1234567890ABCDEF1234567890ABCDEF",
    issuedAt: "2026-07-22T12:00:00.000Z",
  },
  completion: { completedAt: "2026-07-21T12:00:00.000Z" },
  course: { title: "Curso de teste", workloadHours: 10 },
  issuer: {
    cnpj: "12.345.678/0001-90",
    displayName: "Hub Educação",
    legalName: "Hub Educação LTDA",
  },
  rendererVersion: 2,
  student: { name: "Ana Carolina de Souza e Silva" },
  template: {
    backgroundKey: "background.webp",
    fields: [
      {
        align: "center",
        color: "#111111",
        field: "studentName",
        font: "Helvetica-Bold",
        fontSize: 28,
        height: 8,
        visible: true,
        width: 12,
        x: 44,
        y: 46,
        verticalAlign: "middle",
      },
    ],
    id: "2c5c41a6-29c1-4a42-8474-f1f7021d5137",
    signatureKey: null,
    signerName: null,
    signerRole: null,
    version: 1,
  },
  version: 1,
};

describe("versioned certificate PDF rendering", () => {
  it("renders measured and clipped Inter text into a PDF", async () => {
    const background = await sharp({
      create: {
        background: "#ffffff",
        channels: 3,
        height: 1680,
        width: 2376,
      },
    })
      .webp()
      .toBuffer();

    const result = await renderCertificatePdf({
      background,
      publicBaseUrl: "https://hub.example.test",
      signature: null,
      snapshot,
    });

    expect(result.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result.pdf.byteLength).toBeGreaterThan(1000);
    expect(result.sha256).toMatch(SHA256_PATTERN);
  });
});
