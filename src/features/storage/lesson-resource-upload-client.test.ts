import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { uploadBlobWithProgressMock } = vi.hoisted(() => ({
  uploadBlobWithProgressMock: vi.fn(),
}));

vi.mock("./xhr-upload", () => ({
  isUploadAbortedError: (error: unknown, signal?: AbortSignal) =>
    signal?.aborted === true ||
    (error instanceof Error && error.name === "AbortError"),
  UploadAbortedError: class UploadAbortedError extends Error {
    constructor() {
      super("O envio foi cancelado.");
      this.name = "AbortError";
    }
  },
  uploadBlobWithProgress: uploadBlobWithProgressMock,
}));

import { LESSON_SERVER_FALLBACK_MAX_BYTES } from "./lesson-resource-upload";
import { uploadLessonResource } from "./lesson-resource-upload-client";
import { UploadAbortedError } from "./xhr-upload";

const reference = {
  contentType: "application/pdf",
  fileName: "material.pdf",
  id: "resource-1",
  key: "lessons/lesson-1/resources/resource-1-material.pdf",
  label: "material.pdf",
  sizeBytes: 3,
  storage: "r2" as const,
};

const prepared = (uploadUrl: string) => ({
  expiresAt: "2026-08-30T16:00:00.000Z",
  reference,
  uploadUrl,
});

const createFile = (size = 3): File =>
  new File([new Uint8Array(size)], "material.pdf", {
    type: "application/pdf",
  });

describe("lesson resource upload client", () => {
  beforeEach(() => {
    uploadBlobWithProgressMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the original Blob with the prepared Content-Type", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockResolvedValueOnce(Response.json({ reference }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).resolves.toEqual(reference);

    expect(uploadBlobWithProgressMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.any(File),
        headers: { "Content-Type": "application/pdf" },
        url: "https://r2.test/u1",
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/lessons/lesson-1/resources/confirm",
      expect.objectContaining({
        body: JSON.stringify({ resourceId: "resource-1" }),
        method: "POST",
      })
    );
  });

  it("retries a transient confirmation without re-uploading the file", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(Response.json({ reference }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).resolves.toEqual(reference);

    expect(uploadBlobWithProgressMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/admin/lessons/lesson-1/resources/confirm"
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "/api/admin/lessons/lesson-1/resources/confirm"
    );
  });

  it("does not reissue or upload again after a terminal confirmation error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockResolvedValueOnce(
        Response.json(
          { error: "O objeto enviado não corresponde." },
          { status: 400 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).rejects.toThrow("O objeto enviado não corresponde.");

    expect(uploadBlobWithProgressMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reissues the URL and retries the same object key once", async () => {
    const renewedReference = { ...reference };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference: renewedReference,
          uploadUrl: "https://r2.test/u2",
        })
      )
      .mockResolvedValueOnce(Response.json({ reference: renewedReference }));
    vi.stubGlobal("fetch", fetchMock);
    uploadBlobWithProgressMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(undefined);

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).resolves.toEqual(renewedReference);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/lessons/lesson-1/resources/reissue-url",
      expect.objectContaining({
        body: JSON.stringify({ resourceId: "resource-1" }),
        method: "POST",
      })
    );
    expect(uploadBlobWithProgressMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects a reissued response that changes the prepared object key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference: {
            ...reference,
            key: "lessons/other/resources/forged.pdf",
          },
          uploadUrl: "https://r2.test/u2",
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    uploadBlobWithProgressMock.mockRejectedValueOnce(
      new TypeError("Failed to fetch")
    );

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).rejects.toThrow("material preparado");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(uploadBlobWithProgressMock).toHaveBeenCalledTimes(1);
  });

  it("uses the same-origin fallback only for a small file after the bounded retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference,
          uploadUrl: "https://r2.test/u2",
        })
      )
      .mockResolvedValueOnce(Response.json({ reference }));
    vi.stubGlobal("fetch", fetchMock);
    uploadBlobWithProgressMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const file = createFile();

    await expect(
      uploadLessonResource({ file, lessonId: "lesson-1" })
    ).resolves.toEqual(reference);

    const fallbackRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const body = fallbackRequest.body as FormData;
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/admin/lessons/lesson-1/resources/upload",
      expect.objectContaining({ method: "POST" })
    );
    expect(body.get("file")).toBe(file);
    expect(body.get("resourceId")).toBe("resource-1");
  });

  it("uploads an image preview with its separately signed Content-Type", async () => {
    const previewReference = {
      ...reference,
      preview: {
        contentType: "image/webp" as const,
        height: 180,
        key: "lessons/lesson-1/resources/resource-1-preview.webp",
        sizeBytes: 7,
        width: 320,
      },
    };
    const preview = {
      blob: new Blob(["preview"], { type: "image/webp" }),
      contentType: "image/webp" as const,
      height: 180,
      width: 320,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ...prepared("https://r2.test/u1"),
          previewUploadUrl: "https://r2.test/p1",
          reference: previewReference,
        })
      )
      .mockResolvedValueOnce(Response.json({ reference: previewReference }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({
        file: createFile(),
        lessonId: "lesson-1",
        preview,
      })
    ).resolves.toEqual(previewReference);

    expect(uploadBlobWithProgressMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: preview.blob,
        headers: { "Content-Type": "image/webp" },
        url: "https://r2.test/p1",
      })
    );
  });

  it("does not proxy a file larger than the fallback cap", async () => {
    const largeReference = {
      ...reference,
      sizeBytes: LESSON_SERVER_FALLBACK_MAX_BYTES + 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ...prepared("https://r2.test/u1"),
          reference: largeReference,
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference: largeReference,
          uploadUrl: "https://r2.test/u2",
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    uploadBlobWithProgressMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      uploadLessonResource({
        file: createFile(LESSON_SERVER_FALLBACK_MAX_BYTES + 1),
        lessonId: "lesson-1",
      })
    ).rejects.toThrow("Atualize a página e tente novamente");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/lessons/lesson-1/resources/upload",
      expect.anything()
    );
  });

  it("does not retry indefinitely after the second direct failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference,
          uploadUrl: "https://r2.test/u2",
        })
      )
      .mockResolvedValueOnce(Response.json({ reference }));
    vi.stubGlobal("fetch", fetchMock);
    uploadBlobWithProgressMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await uploadLessonResource({ file: createFile(), lessonId: "lesson-1" });

    expect(uploadBlobWithProgressMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not surface a signed URL and includes the safe support correlation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          correlationId: "1858430b-f149-40b6-97f4-56aac713d984",
          error:
            "R2 failed: https://r2.example.test/signed?X-Amz-Signature=secret",
        },
        { status: 400 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).rejects.toThrow(
      "Nao foi possivel preparar o upload. (ID de suporte: 1858430b-f149-40b6-97f4-56aac713d984)"
    );
  });

  it("reports one monotonic percentage across the file and its image preview", async () => {
    const preview = {
      blob: new Blob(["preview"], { type: "image/webp" }),
      contentType: "image/webp" as const,
      height: 180,
      width: 320,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ...prepared("https://r2.test/u1"),
          previewUploadUrl: "https://r2.test/p1",
          reference: {
            ...reference,
            preview: {
              contentType: "image/webp",
              height: 180,
              key: "lessons/lesson-1/resources/resource-1-preview.webp",
              sizeBytes: preview.blob.size,
              width: 320,
            },
          },
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          reference: {
            ...reference,
            preview: {
              contentType: "image/webp",
              height: 180,
              key: "lessons/lesson-1/resources/resource-1-preview.webp",
              sizeBytes: preview.blob.size,
              width: 320,
            },
          },
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    uploadBlobWithProgressMock.mockImplementation(
      ({
        body,
        onProgress,
      }: {
        body: Blob;
        onProgress: (progress: {
          loaded: number;
          percentage: number;
          total: number;
        }) => void;
      }) => {
        onProgress({ loaded: body.size, percentage: 100, total: body.size });
        onProgress({ loaded: body.size, percentage: 100, total: body.size });
      }
    );
    const onProgress = vi.fn();

    await uploadLessonResource({
      file: createFile(),
      lessonId: "lesson-1",
      onProgress,
      preview,
    });

    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { loaded: 3, percentage: 30, total: 10 },
      { loaded: 10, percentage: 100, total: 10 },
    ]);
  });

  it("does not retry or use the server fallback after a user cancellation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")));
    vi.stubGlobal("fetch", fetchMock);
    uploadBlobWithProgressMock.mockRejectedValueOnce(new UploadAbortedError());

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(uploadBlobWithProgressMock).toHaveBeenCalledTimes(1);
  });
});
