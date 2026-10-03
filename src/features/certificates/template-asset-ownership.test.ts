import { describe, expect, it, vi } from "vitest";
import {
  assertCertificateTemplateAssetNamespace,
  assertCertificateTemplateAssetOwnership,
  isCertificateTemplateAssetKey,
} from "./template-asset-ownership";

const backgroundKey =
  "certificates/templates/course-1/11111111-1111-4111-8111-111111111111.webp";
const signatureKey =
  "certificates/templates/course-1/signatures/22222222-2222-4222-8222-222222222222.webp";

describe("certificate template asset ownership", () => {
  it.each([
    {
      backgroundKey: "certificates/private/certificate.pdf",
      signatureKey: null,
    },
    {
      backgroundKey:
        "certificates/templates/course-2/11111111-1111-4111-8111-111111111111.webp",
      signatureKey: null,
    },
    {
      backgroundKey,
      signatureKey: backgroundKey,
    },
    {
      backgroundKey:
        "certificates/templates/course-1/signatures/22222222-2222-4222-8222-222222222222.webp",
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
    "certificates/templates/course-2/signatures/22222222-2222-4222-8222-222222222222.webp",
    "certificates/templates/course-1/signatures/../22222222-2222-4222-8222-222222222222.webp",
    "certificates/templates/course-1/signatures/22222222-2222-4222-8222-222222222222.webp/extra",
    "certificates/templates/course-1/signatures/22222222-2222-4222-8222-222222222222.pdf",
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

  it("preserves catalogued legacy PNG and JPG assets in their existing slots", async () => {
    const legacyBackgroundKey =
      "certificates/templates/course-1/33333333-3333-4333-8333-333333333333.png";
    const legacySignatureKey =
      "certificates/templates/course-1/signatures/44444444-4444-4444-8444-444444444444.jpg";
    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            background_key: legacyBackgroundKey,
            signature_key: legacySignatureKey,
          },
        ],
      }),
    };

    await expect(
      assertCertificateTemplateAssetOwnership({
        backgroundKey: legacyBackgroundKey,
        client,
        courseId: "course-1",
        signatureKey: legacySignatureKey,
        uploadedAssetKeys: [],
      })
    ).resolves.toBeUndefined();
    expect(
      isCertificateTemplateAssetKey({
        asset: "background",
        courseId: "course-1",
        key: legacyBackgroundKey,
      })
    ).toBe(true);
  });
});
