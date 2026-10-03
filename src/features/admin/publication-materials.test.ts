import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  copy: vi.fn(),
  register: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/storage/r2", () => ({
  copyLessonResourceForPublication: dependencies.copy,
}));
vi.mock("@/features/storage/lesson-resource-upload-registry", () => ({
  registerLessonResourcePublicationCopy: dependencies.register,
}));

import { preparePublicationLessonMaterials } from "./publication-materials";

const resource = {
  contentType: "application/pdf",
  fileName: "material.pdf",
  id: "resource-1",
  key: "lessons/lesson-1/resources/upload-material.pdf",
  label: "Material",
  preview: {
    contentType: "image/webp" as const,
    height: 180,
    key: "lessons/lesson-1/resources/upload-preview.webp",
    sizeBytes: 5,
    width: 320,
  },
  sizeBytes: 10,
  storage: "r2" as const,
};
const contentJson = {
  document: { type: "doc", content: [{ type: "paragraph" }] },
  resources: [resource],
  type: "text",
};

describe("publication material isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.copy.mockResolvedValue(undefined);
    dependencies.register.mockResolvedValue(undefined);
  });

  it("publishes separate attachment and preview keys while preserving the resource identity", async () => {
    const prepared = await preparePublicationLessonMaterials({
      actorUserId: "admin-1",
      materials: [{ lessonId: "lesson-1", contentJson }],
    });
    const copied = dependencies.copy.mock.calls[0]?.[0].destination;
    expect(copied.key).toContain("/resources/published/");
    expect(copied.preview.key).toContain("/resources/published/");
    expect(copied.key).not.toBe(resource.key);
    expect(copied.id).toBe(resource.id);
    expect(contentJson.resources[0]?.key).toBe(resource.key);
    expect(prepared[0]?.contentJson).toMatchObject({ resources: [copied] });
    expect(dependencies.register).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        lessonId: "lesson-1",
        reference: expect.objectContaining({ key: copied.key }),
      })
    );
    expect(dependencies.register.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.copy.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    );
  });

  it("preserves inherited immutable materials without another provider copy", async () => {
    const published = {
      ...resource,
      key: "lessons/lesson-1/resources/published/12345678-material.pdf",
      preview: {
        ...resource.preview,
        key: "lessons/lesson-1/resources/published/12345678-preview.webp",
      },
    };
    const prepared = await preparePublicationLessonMaterials({
      actorUserId: "admin-1",
      materials: [
        {
          lessonId: "lesson-clone",
          contentJson: { ...contentJson, resources: [published] },
        },
      ],
    });
    expect(prepared[0]?.contentJson).toMatchObject({ resources: [published] });
    expect(dependencies.copy).not.toHaveBeenCalled();
    expect(dependencies.register).not.toHaveBeenCalled();
  });

  it("stops preparation on provider failure while retaining the cleanup registration", async () => {
    dependencies.copy.mockRejectedValue(new Error("copy_source_changed"));
    await expect(
      preparePublicationLessonMaterials({
        actorUserId: "admin-1",
        materials: [{ lessonId: "lesson-1", contentJson }],
      })
    ).rejects.toThrow("copy_source_changed");
    expect(dependencies.register).toHaveBeenCalledOnce();
    expect(contentJson.resources[0]?.key).toBe(resource.key);
  });
});
