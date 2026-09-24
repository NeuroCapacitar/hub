import { afterEach, describe, expect, it, vi } from "vitest";

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

import { uploadStagedAdminImage } from "./staged-image-upload-client";

const reference = {
  aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
  contentType: "image/png",
  fileName: "capa.png",
  key: "uploads/admin-images/admin-1/course/c989d54d-d13f-46a1-89ed-2069d7c1c45b/course-cover/upload-capa.png",
  purpose: "course-cover" as const,
  sizeBytes: 4,
};

describe("uploadStagedAdminImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    uploadBlobWithProgressMock.mockReset();
  });

  it("prepares an actor-scoped upload and sends the binary directly to R2", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          reference,
          uploadUrl: "https://r2.example.test/signed-upload",
        })
      )
      .mockResolvedValueOnce(Response.json({ reference }));
    vi.stubGlobal("fetch", fetchMock);
    uploadBlobWithProgressMock.mockResolvedValue(undefined);
    const file = new File(["capa"], "capa.png", { type: "image/png" });
    const onStatus = vi.fn();

    await expect(
      uploadStagedAdminImage({
        aggregateId: reference.aggregateId,
        file,
        onStatus,
        purpose: "course-cover",
      })
    ).resolves.toEqual(reference);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/uploads/images/prepare",
      expect.objectContaining({
        body: JSON.stringify({
          aggregateId: reference.aggregateId,
          contentType: "image/png",
          fileName: "capa.png",
          purpose: "course-cover",
          sizeBytes: 4,
        }),
        method: "POST",
      })
    );
    expect(uploadBlobWithProgressMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: file,
        headers: { "content-type": "image/png" },
        url: "https://r2.example.test/signed-upload",
      })
    );
    expect(onStatus.mock.calls.map(([status]) => status.phase)).toEqual([
      "preparing",
      "uploading",
      "confirming",
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/uploads/images/confirm",
      expect.objectContaining({
        body: JSON.stringify({ reference }),
        method: "POST",
      })
    );
  });

  it("surfaces a preparation rejection without contacting R2", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "Imagem acima do limite." }, { status: 400 })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadStagedAdminImage({
        aggregateId: reference.aggregateId,
        file: new File(["x"], "capa.png", { type: "image/png" }),
        purpose: "course-cover",
      })
    ).rejects.toThrow("Imagem acima do limite.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the same-origin upload when the direct R2 request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          reference,
          uploadUrl: "https://r2.example.test/signed-upload",
        })
      )
      .mockResolvedValueOnce(Response.json({ reference }));
    vi.stubGlobal("fetch", fetchMock);
    uploadBlobWithProgressMock.mockRejectedValueOnce(
      new TypeError("Failed to fetch")
    );
    const file = new File(["capa"], "capa.png", { type: "image/png" });

    await expect(
      uploadStagedAdminImage({
        aggregateId: reference.aggregateId,
        file,
        purpose: "course-cover",
      })
    ).resolves.toEqual(reference);

    const fallbackRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const formData = fallbackRequest.body as FormData;
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/uploads/images/upload",
      expect.objectContaining({ method: "POST" })
    );
    expect(formData.get("file")).toBe(file);
    expect(formData.get("reference")).toBe(JSON.stringify(reference));
  });

  it("never falls back to the server after cancellation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        reference,
        uploadUrl: "https://r2.example.test/signed-upload",
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    uploadBlobWithProgressMock.mockRejectedValueOnce(
      new (await import("./xhr-upload")).UploadAbortedError()
    );

    await expect(
      uploadStagedAdminImage({
        aggregateId: reference.aggregateId,
        file: new File(["capa"], "capa.png", { type: "image/png" }),
        purpose: "course-cover",
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
