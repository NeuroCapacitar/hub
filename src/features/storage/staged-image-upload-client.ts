"use client";

import type {
  StagedAdminImagePurpose,
  StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";
import {
  isUploadAbortedError,
  UploadAbortedError,
  type UploadStatusPhase,
  type UploadTransferProgress,
  uploadBlobWithProgress,
} from "@/features/storage/xhr-upload";

interface PreparedStagedAdminImageUpload {
  reference: StagedAdminImageReference;
  uploadUrl: string;
}

const readErrorMessage = async (response: Response): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  return "Nao foi possivel enviar a imagem.";
};

export const uploadStagedAdminImage = async ({
  aggregateId,
  file,
  onStatus,
  purpose,
  signal,
}: {
  aggregateId: string;
  file: File;
  onStatus?:
    | ((status: {
        phase: UploadStatusPhase;
        progress?: UploadTransferProgress;
      }) => void)
    | undefined;
  purpose: StagedAdminImagePurpose;
  signal?: AbortSignal | undefined;
}): Promise<StagedAdminImageReference> => {
  try {
    onStatus?.({ phase: "preparing" });
    const preparation = await fetch("/api/admin/uploads/images/prepare", {
      body: JSON.stringify({
        aggregateId,
        contentType: file.type,
        fileName: file.name,
        purpose,
        sizeBytes: file.size,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: signal ?? null,
    });

    if (!preparation.ok) {
      throw new Error(await readErrorMessage(preparation));
    }

    const prepared =
      (await preparation.json()) as PreparedStagedAdminImageUpload;
    let directUploadSucceeded = false;
    try {
      onStatus?.({ phase: "uploading" });
      await uploadBlobWithProgress({
        body: file,
        headers: { "content-type": file.type },
        onProgress: (progress) => onStatus?.({ phase: "uploading", progress }),
        signal,
        url: prepared.uploadUrl,
      });
      directUploadSucceeded = true;
    } catch (error) {
      if (isUploadAbortedError(error, signal)) {
        throw new UploadAbortedError();
      }
    }

    if (!directUploadSucceeded) {
      onStatus?.({ phase: "fallback" });
      const formData = new FormData();
      formData.set("file", file);
      formData.set("reference", JSON.stringify(prepared.reference));
      const fallbackUpload = await fetch("/api/admin/uploads/images/upload", {
        body: formData,
        method: "POST",
        signal: signal ?? null,
      });

      if (!fallbackUpload.ok) {
        throw new Error(await readErrorMessage(fallbackUpload));
      }

      const fallbackConfirmed = (await fallbackUpload.json()) as {
        reference: StagedAdminImageReference;
      };
      return fallbackConfirmed.reference;
    }

    onStatus?.({ phase: "confirming" });
    const confirmation = await fetch("/api/admin/uploads/images/confirm", {
      body: JSON.stringify({ reference: prepared.reference }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: signal ?? null,
    });
    if (!confirmation.ok) {
      throw new Error(await readErrorMessage(confirmation));
    }

    const confirmed = (await confirmation.json()) as {
      reference: StagedAdminImageReference;
    };
    return confirmed.reference;
  } catch (error) {
    if (isUploadAbortedError(error, signal)) {
      throw new UploadAbortedError();
    }
    throw error;
  }
};
