import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  getPublicMediaUrl: vi.fn(),
  requirePermission: vi.fn(),
  query: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  getPublicMediaUrl: dependencies.getPublicMediaUrl,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));

import {
  getActiveAuthMediaData,
  getAdminAuthMediaData,
  getAdminAuthMediaImageKey,
} from "./server";

const ACTIVE_KEY =
  "auth-media/c989d54d-d13f-46a1-89ed-2069d7c1c45b/44feef7e-1b03-46a1-89ed-2069d7c1c45b.webp";

describe("authentication media server projections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getPool.mockReturnValue({ query: dependencies.query });
    dependencies.requirePermission.mockResolvedValue({
      role: "admin",
      user: { id: "admin-1" },
    });
    dependencies.getPublicMediaUrl.mockReturnValue(
      "https://media.example.test/auth-media/slide.webp"
    );
  });

  it("returns admin slides through protected preview URLs", async () => {
    dependencies.query.mockResolvedValue({
      rows: [
        {
          blur_data_url: "data:image/webp;base64,blur",
          id: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
          image_url: ACTIVE_KEY,
          is_active: true,
          sort_order: 1,
          updated_at: new Date("2026-09-14T00:00:00.000Z"),
        },
      ],
    });

    await expect(getAdminAuthMediaData()).resolves.toEqual({
      slides: [
        {
          blurDataUrl: "data:image/webp;base64,blur",
          id: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
          imageUrl:
            "/api/admin/auth-media/c989d54d-d13f-46a1-89ed-2069d7c1c45b/image",
          isActive: true,
          sortOrder: 1,
        },
      ],
    });
    expect(dependencies.requirePermission).toHaveBeenCalledWith("viewSettings");
  });

  it("returns only active, namespaced slides with a cache-busting version", async () => {
    dependencies.query.mockResolvedValue({
      rows: [
        {
          blur_data_url: "blur-1",
          id: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
          image_url: ACTIVE_KEY,
          is_active: true,
          sort_order: 1,
          updated_at: new Date("2026-09-14T00:00:00.000Z"),
        },
        {
          blur_data_url: "blur-2",
          id: "44feef7e-1b03-46c4-8119-ad22e5e57826",
          image_url: "courses/not-auth.webp",
          is_active: true,
          sort_order: 2,
          updated_at: new Date("2026-09-14T00:00:00.000Z"),
        },
      ],
    });

    await expect(getActiveAuthMediaData()).resolves.toEqual({
      slides: [
        {
          blurDataUrl: "blur-1",
          id: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
          imageUrl:
            "https://media.example.test/auth-media/slide.webp?v=1789344000000",
          sortOrder: 1,
        },
      ],
    });
  });

  it("does not expose an invalid admin image key", async () => {
    await expect(getAdminAuthMediaImageKey("not-a-uuid")).resolves.toBeNull();
    expect(dependencies.query).not.toHaveBeenCalled();
  });
});
