import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";
import { encodeCertificateCode } from "./certificate-code";

const CERTIFICATE_CODE_PATTERN = /^[A-Za-z0-9_-]{21}[AQgw]$/;

vi.mock("server-only", () => ({}));

describe("certificate code encoding", () => {
  it("encodes exactly 16 bytes as canonical unpadded Base64URL", () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
    const code = encodeCertificateCode(bytes);

    expect(code).toBe("AAECAwQFBgcICQoLDA0ODw");
    expect(code).toHaveLength(22);
    expect(code).toMatch(CERTIFICATE_CODE_PATTERN);
    expect(code).not.toContain("=");
    expect(Buffer.from(code, "base64url")).toEqual(Buffer.from(bytes));
  });

  it("preserves Base64URL hyphen, underscore, and case", () => {
    expect(encodeCertificateCode(new Uint8Array(16).fill(251))).toBe(
      "-_v7-_v7-_v7-_v7-_v7-w"
    );
    expect(encodeCertificateCode(new Uint8Array(16).fill(255))).toBe(
      "_____________________w"
    );
  });

  it("rejects byte sequences whose length is not 128 bits", () => {
    expect(() => encodeCertificateCode(new Uint8Array(15))).toThrow(
      "Certificate codes require exactly 16 random bytes."
    );
    expect(() => encodeCertificateCode(new Uint8Array(17))).toThrow(
      "Certificate codes require exactly 16 random bytes."
    );
  });
});
