import { describe, expect, it, vi } from "vitest";
import {
  assertCertificateTemplateAssetNamespace,
  assertCertificateTemplateAssetOwnership,
  isCertificateTemplateAssetKey,
} from "./template-asset-ownership";

const backgroundKey = "certificates/templates/course-1/background.webp";
const signatureKey =
  "certificates/templates/course-1/signatures/signature.webp";

describe("certificate template asset ownership", () => {
  it.each([
    {
      backgroundKey: "certificates/private/certificate.pdf",
      signatureKey: null,
    },
    {
      backgroundKey: "certificates/templates/course-2/background.webp",
      signatureKey: null,
    },
    {
      backgroundKey,
      signatureKey: "certificates/templates/course-1/background.webp",
    },
    {
      backgroundKey:
        "certificates/templates/course-1/signatures/signature.webp",
      signatureKey: null,
    },
  ])("rejects legacy asset namespace and slot substitutions", (assets) => {
    expect(() =>
      assertCertificateTemplateAssetNamespace({
        ...assets,
        courseId: "course-1",
      })
    ).toThrow("não pertence");
  });

  it.each([
    "certificates/certificate-1/certificate.pdf",
    "certificates/templates/course-2/signatures/signature.webp",
    "certificates/templates/course-1/signatures/../signature.webp",
    "certificates/templates/course-1/signatures/signature.webp/extra",
    "certificates/templates/course-1/signatures/signature.pdf",
    "certificates/templates/course-1/signatures/signature%2Ewebp",
  ])("rejects an unscoped signature before reading or saving metadata: %s", async (key) => {
    const client = { query: vi.fn() };
    await expect(
      assertCertificateTemplateAssetOwnership({
        backgroundKey,
        client,
        courseId: "course-1",
        signatureKey: key,
        uploadedAssetKeys: [backgroundKey, key],
      })
    ).rejects.toThrow("não pertence");
    expect(client.query).not.toHaveBeenCalled();
  });

  it("rejects a guessed same-course key that was neither uploaded nor preserved", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await expect(
      assertCertificateTemplateAssetOwnership({
        backgroundKey,
        client,
        courseId: "course-1",
        signatureKey,
        uploadedAssetKeys: [backgroundKey],
      })
    ).rejects.toThrow("Envie a imagem");
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("where course_id = $1"),
      ["course-1"]
    );
  });

  it("accepts only assets recorded in their original same-course slot", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ background_key: backgroundKey, signature_key: signatureKey }],
      }),
    };
    await expect(
      assertCertificateTemplateAssetOwnership({
        backgroundKey,
        client,
        courseId: "course-1",
        signatureKey,
        uploadedAssetKeys: [],
      })
    ).resolves.toBeUndefined();
    expect(
      isCertificateTemplateAssetKey({
        asset: "background",
        courseId: "course-1",
        key: signatureKey,
      })
    ).toBe(false);
  });

  it("permits fresh server uploads and signature removal", async () => {
    const client = { query: vi.fn() };
    await expect(
      assertCertificateTemplateAssetOwnership({
        backgroundKey,
        client,
        courseId: "course-1",
        signatureKey,
        uploadedAssetKeys: [backgroundKey, signatureKey],
      })
    ).resolves.toBeUndefined();
    await expect(
      assertCertificateTemplateAssetOwnership({
        backgroundKey,
        client,
        courseId: "course-1",
        signatureKey: null,
        uploadedAssetKeys: [backgroundKey],
      })
    ).resolves.toBeUndefined();
    expect(client.query).not.toHaveBeenCalled();
  });
});
