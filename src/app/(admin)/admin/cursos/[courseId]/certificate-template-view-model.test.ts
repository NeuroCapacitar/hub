import { describe, expect, it } from "vitest";
import { getCertificateEditorStatus } from "./certificate-template-view-model";

describe("getCertificateEditorStatus", () => {
  it("distinguishes disabled, draft, active, and active with changes", () => {
    expect(
      getCertificateEditorStatus({
        certificateEnabled: false,
        hasDraft: false,
        hasPublished: false,
        signatoryConfigured: false,
      })
    ).toEqual({ label: "Desligado", tone: "secondary" });
    expect(
      getCertificateEditorStatus({
        certificateEnabled: false,
        hasDraft: true,
        hasPublished: false,
        signatoryConfigured: false,
      })
    ).toEqual({ label: "Rascunho", tone: "secondary" });
    expect(
      getCertificateEditorStatus({
        certificateEnabled: true,
        hasDraft: false,
        hasPublished: true,
        signatoryConfigured: true,
      })
    ).toEqual({ label: "Ativo", tone: "default" });
    expect(
      getCertificateEditorStatus({
        certificateEnabled: true,
        hasDraft: true,
        hasPublished: true,
        signatoryConfigured: true,
      })
    ).toEqual({ label: "Ativo + alterações", tone: "outline" });
  });

  it("never presents an enabled course without a published template as active", () => {
    expect(
      getCertificateEditorStatus({
        certificateEnabled: true,
        hasDraft: true,
        hasPublished: false,
        signatoryConfigured: false,
      }).label
    ).toBe("Configuração incompleta");
  });

  it("marks a legacy published certificate without an explicit signatory as incomplete", () => {
    expect(
      getCertificateEditorStatus({
        certificateEnabled: true,
        hasDraft: false,
        hasPublished: true,
        signatoryConfigured: false,
      })
    ).toEqual({ label: "Configuração incompleta", tone: "outline" });
  });
});
