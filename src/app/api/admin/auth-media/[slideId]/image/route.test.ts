import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createR2ObjectReadUrl: vi.fn(),
  getAdminAuthMediaImageKey: vi.fn(),
}));

vi.mock("@/features/auth-media/server", () => ({
  getAdminAuthMediaImageKey: dependencies.getAdminAuthMediaImageKey,
}));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: dependencies.createR2ObjectReadUrl,
}));

import { GET } from "./route";

const params = (slideId: string): { params: Promise<{ slideId: string }> } => ({
  params: Promise.resolve({ slideId }),
});

describe("GET /api/admin/auth-media/[slideId]/image", () => {
  it("returns not found when the protected slide does not exist", async () => {
    dependencies.getAdminAuthMediaImageKey.mockResolvedValue(null);

    const response = await GET(
      new Request(
        "https://hub.example.test/api/admin/auth-media/missing/image"
      ),
      params("missing")
    );

    expect(response.status).toBe(404);
    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
  });

  it("redirects to a short-lived private object URL", async () => {
    dependencies.getAdminAuthMediaImageKey.mockResolvedValue(
      "auth-media/c989d54d-d13f-46a1-89ed-2069d7c1c45b/44feef7e-1b03-46c4-8119-ad22e5e57826.webp"
    );
    dependencies.createR2ObjectReadUrl.mockResolvedValue(
      "https://private.example.test/signed"
    );

    const response = await GET(
      new Request("https://hub.example.test/api/admin/auth-media/slide/image"),
      params("c989d54d-d13f-46a1-89ed-2069d7c1c45b")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://private.example.test/signed"
    );
  });
});
