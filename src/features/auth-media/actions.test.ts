import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => {
  const clientQuery = vi.fn();
  const client = {
    query: clientQuery,
    release: vi.fn(),
  };
  const poolQuery = vi.fn();
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
    query: poolQuery,
  };

  return {
    client,
    clientQuery,
    consumeStagedAdminImageUpload: vi.fn(),
    getPool: vi.fn(() => pool),
    parseStagedAdminImageReference: vi.fn(),
    poolQuery,
    removeAuthMediaObject: vi.fn(),
    requirePermission: vi.fn(),
    revalidatePath: vi.fn(),
    synchronizeAuthMediaPublicObject: vi.fn(),
    uploadAuthMediaFile: vi.fn(),
    writeAuditLog: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: dependencies.revalidatePath,
}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/admin/audit-log", () => ({
  writeAuditLog: dependencies.writeAuditLog,
}));
vi.mock("@/features/auth-media/storage", () => ({
  removeAuthMediaObject: dependencies.removeAuthMediaObject,
  synchronizeAuthMediaPublicObject:
    dependencies.synchronizeAuthMediaPublicObject,
}));
vi.mock("@/features/storage/r2", () => ({
  uploadAuthMediaFile: dependencies.uploadAuthMediaFile,
}));
vi.mock("@/features/storage/staged-image-upload", () => ({
  parseStagedAdminImageReference: dependencies.parseStagedAdminImageReference,
}));
vi.mock("@/features/storage/staged-image-upload-registry", () => ({
  consumeStagedAdminImageUpload: dependencies.consumeStagedAdminImageUpload,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));

import {
  deleteAuthMediaAction,
  reorderAuthMediaAction,
  saveAuthMediaAction,
  toggleAuthMediaActiveAction,
} from "./actions";

const SLIDE_ID = "c989d54d-d13f-46a1-89ed-2069d7c1c45b";
const SECOND_SLIDE_ID = "44feef7e-1b03-46c4-8119-ad22e5e57826";
const IMAGE_KEY =
  "auth-media/c989d54d-d13f-46a1-89ed-2069d7c1c45b/44feef7e-1b03-46a1-89ed-2069d7c1c45b.webp";

const stagedReference = {
  aggregateId: SLIDE_ID,
  contentType: "image/webp",
  fileName: "slide.webp",
  key: `uploads/admin-images/admin-1/auth-media-slide/${SLIDE_ID}/auth-media/upload-slide.webp`,
  purpose: "auth-media" as const,
  sizeBytes: 1024,
};

const createFormData = (values: Record<string, string>): FormData => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
};

describe("authentication media actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requirePermission.mockResolvedValue({
      role: "admin",
      user: { id: "admin-1" },
    });
    dependencies.parseStagedAdminImageReference.mockReturnValue(
      stagedReference
    );
    dependencies.uploadAuthMediaFile.mockResolvedValue({
      blurDataUrl: "blur",
      key: IMAGE_KEY,
    });
    dependencies.synchronizeAuthMediaPublicObject.mockResolvedValue(undefined);
    dependencies.removeAuthMediaObject.mockResolvedValue(undefined);
    dependencies.writeAuditLog.mockResolvedValue(undefined);
    dependencies.clientQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    dependencies.poolQuery.mockResolvedValue({ rows: [] });
    dependencies.consumeStagedAdminImageUpload.mockImplementation(
      async ({ operation }: { operation: (file: File) => Promise<unknown> }) =>
        await operation(
          new File(["image"], "slide.webp", { type: "image/webp" })
        )
    );
  });

  it("persists a new slide only after publishing its private object", async () => {
    dependencies.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      saveAuthMediaAction(
        createFormData({
          imageUpload: JSON.stringify(stagedReference),
          isActive: "on",
          newSlideId: SLIDE_ID,
        })
      )
    ).resolves.toEqual({ slideId: SLIDE_ID });

    expect(dependencies.consumeStagedAdminImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateId: SLIDE_ID,
        purpose: "auth-media",
        reference: stagedReference,
      })
    );
    expect(dependencies.synchronizeAuthMediaPublicObject).toHaveBeenCalledWith({
      isActive: true,
      key: IMAGE_KEY,
    });
    expect(dependencies.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("insert into auth_media_slides"),
      [SLIDE_ID, IMAGE_KEY, "blur", true, 1]
    );
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth_media_slide.created",
        targetId: SLIDE_ID,
        targetType: "auth_media_slide",
      })
    );
  });

  it("enforces the five-slide limit and cleans a failed new object", async () => {
    dependencies.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "5" }] });

    await expect(
      saveAuthMediaAction(
        createFormData({
          imageUpload: JSON.stringify(stagedReference),
          isActive: "on",
          newSlideId: SLIDE_ID,
        })
      )
    ).rejects.toThrow("Limite de cinco imagens da tela de acesso atingido.");
    expect(dependencies.clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(dependencies.removeAuthMediaObject).toHaveBeenCalledWith(IMAGE_KEY);
  });

  it("normalizes and audits a complete reorder under a table lock", async () => {
    dependencies.clientQuery.mockImplementation((sql: string) => {
      if (sql.includes("select id, sort_order")) {
        return Promise.resolve({
          rows: [
            { id: SLIDE_ID, sort_order: 1 },
            { id: SECOND_SLIDE_ID, sort_order: 2 },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(
      reorderAuthMediaAction([SECOND_SLIDE_ID, SLIDE_ID])
    ).resolves.toBeUndefined();

    expect(dependencies.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("LOCK TABLE auth_media_slides")
    );
    expect(dependencies.clientQuery).toHaveBeenCalledWith(
      expect.stringContaining("sort_order = $1"),
      [1, SECOND_SLIDE_ID]
    );
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth_media_slides.reordered",
        targetType: "auth_media_slide",
      })
    );
  });

  it("removes public access before deleting a slide", async () => {
    dependencies.poolQuery.mockResolvedValue({
      rows: [
        {
          blur_data_url: "blur",
          id: SLIDE_ID,
          image_url: IMAGE_KEY,
          is_active: true,
          sort_order: 1,
        },
      ],
    });

    await expect(
      deleteAuthMediaAction(createFormData({ slideId: SLIDE_ID }))
    ).resolves.toBeUndefined();

    expect(dependencies.synchronizeAuthMediaPublicObject).toHaveBeenCalledWith({
      isActive: false,
      key: IMAGE_KEY,
    });
    expect(dependencies.clientQuery).toHaveBeenCalledWith(
      "delete from auth_media_slides where id = $1",
      [SLIDE_ID]
    );
    expect(dependencies.removeAuthMediaObject).toHaveBeenCalledWith(IMAGE_KEY);
  });

  it("publishes or removes the object when the Admin toggles activity", async () => {
    dependencies.poolQuery.mockResolvedValue({
      rows: [
        {
          blur_data_url: "blur",
          id: SLIDE_ID,
          image_url: IMAGE_KEY,
          is_active: false,
          sort_order: 1,
        },
      ],
    });

    await toggleAuthMediaActiveAction(
      createFormData({ isActive: "on", slideId: SLIDE_ID })
    );

    expect(dependencies.synchronizeAuthMediaPublicObject).toHaveBeenCalledWith({
      isActive: true,
      key: IMAGE_KEY,
    });
    expect(dependencies.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth_media_slide.updated",
        targetId: SLIDE_ID,
      })
    );
  });

  it("restores public access when the activity transaction fails", async () => {
    dependencies.poolQuery.mockResolvedValue({
      rows: [
        {
          blur_data_url: "blur",
          id: SLIDE_ID,
          image_url: IMAGE_KEY,
          is_active: false,
          sort_order: 1,
        },
      ],
    });
    const databaseError = new Error("database unavailable");
    dependencies.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(databaseError)
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      toggleAuthMediaActiveAction(
        createFormData({ isActive: "on", slideId: SLIDE_ID })
      )
    ).rejects.toBe(databaseError);

    expect(
      dependencies.synchronizeAuthMediaPublicObject
    ).toHaveBeenNthCalledWith(1, { isActive: true, key: IMAGE_KEY });
    expect(
      dependencies.synchronizeAuthMediaPublicObject
    ).toHaveBeenNthCalledWith(2, { isActive: false, key: IMAGE_KEY });
  });

  it("restores public access when deleting a slide transaction fails", async () => {
    dependencies.poolQuery.mockResolvedValue({
      rows: [
        {
          blur_data_url: "blur",
          id: SLIDE_ID,
          image_url: IMAGE_KEY,
          is_active: true,
          sort_order: 1,
        },
      ],
    });
    const databaseError = new Error("database unavailable");
    dependencies.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(databaseError)
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      deleteAuthMediaAction(createFormData({ slideId: SLIDE_ID }))
    ).rejects.toBe(databaseError);

    expect(
      dependencies.synchronizeAuthMediaPublicObject
    ).toHaveBeenNthCalledWith(1, { isActive: false, key: IMAGE_KEY });
    expect(
      dependencies.synchronizeAuthMediaPublicObject
    ).toHaveBeenNthCalledWith(2, { isActive: true, key: IMAGE_KEY });
  });
});
