import { describe, expect, it } from "vitest";
import { canIssueCertificate, getCertificateValidationPath } from "./rules";

describe("certificate rules", () => {
  it("issues certificates only when every lesson is completed", () => {
    expect(
      canIssueCertificate({ totalLessons: 24, completedLessons: 24 })
    ).toBe(true);
    expect(
      canIssueCertificate({ totalLessons: 24, completedLessons: 23 })
    ).toBe(false);
    expect(canIssueCertificate({ totalLessons: 0, completedLessons: 0 })).toBe(
      false
    );
  });

  it("creates stable validation paths from certificate codes", () => {
    expect(getCertificateValidationPath("PRT-2026-ABC123")).toBe(
      "/certificados/PRT-2026-ABC123"
    );
  });

  it("preserves Base64URL case and characters in validation paths", () => {
    const code = "-_v7-_v7-_v7-_v7-_v7-w";

    expect(getCertificateValidationPath(code)).toBe(`/certificados/${code}`);
  });
});
