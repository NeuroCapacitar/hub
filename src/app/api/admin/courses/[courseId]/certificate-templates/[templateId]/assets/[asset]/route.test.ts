import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createR2ObjectReadUrl: vi.fn(),
  query: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query: dependencies.query }) }));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: dependencies.createR2ObjectReadUrl,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));

import { GET } from "./route";

const assetKey =
  "certificates/templates/course-1/11111111-1111-4111-8111-111111111111.webp";

const getAsset = async ({
  asset = "background",
  version = assetKey,
}: {
  asset?: string;
  version?: string;
} = {}) =>
  await GET(
    new Request(`https://hub.example/image?v=${encodeURIComponent(version)}`),
    {
      params: Promise.resolve({
        asset,
        courseId: "course-1",
        templateId: "template-1",
      }),
    }
  );

describe("certificate template image delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.query.mockResolvedValue({
      rows: [{ background_key: assetKey, signature_key: null }],
    });
    dependencies.createR2ObjectReadUrl.mockResolvedValue(
      "https://private.example/signed-image"
    );
  });

  it("redirects to the current private asset with a short browser-private cache", async () => {
    const response = await getAsset();

    expect(dependencies.requirePermission).toHaveBeenCalledWith("viewCourses");
    expect(dependencies.createR2ObjectReadUrl).toHaveBeenCalledWith({
      key: assetKey,
      responseCacheControl: "private, max-age=240",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://private.example/signed-image"
    );
    expect(response.headers.get("cache-control")).toBe("private, max-age=240");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("rejects a stale version key without issuing a signed URL", async () => {
    const response = await getAsset({ version: "certificates/old.webp" });

    expect(response.status).toBe(404);
    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
  });

  it.each([
    "certificates/revoked.pdf",
    "certificates/templates/course-2/11111111-1111-4111-8111-111111111111.webp",
    "certificates/templates/course-1/11111111-1111-4111-8111-111111111111.pdf",
    "certificates/templates/course-1/../revoked.pdf",
    "certificates/templates/course-1/signatures/11111111-1111-4111-8111-111111111111.webp",
  ])("does not sign an invalid stored background reference: %s", async (key) => {
    dependencies.query.mockResolvedValue({
      rows: [{ background_key: key, signature_key: null }],
    });

    const response = await getAsset({ version: key });

    expect(response.status).toBe(404);
    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
  });

  it("signs a legitimate signature from its own asset namespace", async () => {
    const signatureKey =
      "certificates/templates/course-1/signatures/11111111-1111-4111-8111-111111111111.webp";
    dependencies.query.mockResolvedValue({
      rows: [{ background_key: assetKey, signature_key: signatureKey }],
    });

    const response = await getAsset({
      asset: "signature",
      version: signatureKey,
    });

    expect(response.status).toBe(302);
    expect(dependencies.createR2ObjectReadUrl).toHaveBeenCalledWith({
      key: signatureKey,
      responseCacheControl: "private, max-age=240",
    });
  });

  it("does not expose an asset type outside the two supported fields", async () => {
    const response = await getAsset({ asset: "other" });

    expect(response.status).toBe(404);
    expect(dependencies.query).not.toHaveBeenCalled();
  });
});
