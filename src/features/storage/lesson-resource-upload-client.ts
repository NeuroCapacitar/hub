import { LESSON_SERVER_FALLBACK_MAX_BYTES } from "@/features/storage/lesson-resource-upload";
import { validateLessonAttachmentUpload } from "@/features/storage/r2-objects";
import {
  isUploadAbortedError,
  UploadAbortedError,
  type UploadStatusPhase,
  type UploadTransferProgress,
  uploadBlobWithProgress,
} from "@/features/storage/xhr-upload";

export interface LessonResourceUploadPreview {
  blob: Blob;
  contentType: "image/webp";
  height: number;
  width: number;
}

export interface LessonResourceUploadReference {
  contentType: string;
  fileName: string;
  id: string;
  key: string;
  label: string;
  preview?: {
    contentType: "image/webp";
    height: number;
    key: string;
    sizeBytes: number;
    width: number;
  };
  sizeBytes: number;
  storage: "r2";
}

interface PreparedLessonResourceUpload {
  expiresAt: string;
  previewUploadUrl?: string;
  reference: LessonResourceUploadReference;
  uploadUrl: string;
}

class DirectLessonResourceUploadError extends Error {}
class InvalidLessonResourceUploadError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const LESSON_UPLOAD_CONFIRMATION_ATTEMPTS = 2;
const SUPPORT_CORRELATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isPreviewReference = (
  value: unknown
): value is NonNullable<LessonResourceUploadReference["preview"]> => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.contentType === "image/webp" &&
    typeof value.height === "number" &&
    typeof value.key === "string" &&
    typeof value.sizeBytes === "number" &&
    typeof value.width === "number"
  );
};

const isReference = (
  value: unknown
): value is LessonResourceUploadReference => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.contentType === "string" &&
    typeof value.fileName === "string" &&
    typeof value.id === "string" &&
    typeof value.key === "string" &&
    typeof value.label === "string" &&
    (value.preview === undefined || isPreviewReference(value.preview)) &&
    typeof value.sizeBytes === "number" &&
    value.storage === "r2"
  );
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const readSafeError = (value: unknown, fallback: string): string => {
  const message =
    isRecord(value) &&
    typeof value.error === "string" &&
    value.error.length <= 200 &&
    !value.error.includes("://")
      ? value.error
      : fallback;
  const correlationId =
    isRecord(value) &&
    typeof value.correlationId === "string" &&
    SUPPORT_CORRELATION_ID_PATTERN.test(value.correlationId)
      ? value.correlationId
      : null;

  return correlationId
    ? `${message} (ID de suporte: ${correlationId})`
    : message;
};

const readPreparedUpload = async (
  response: Response,
  fallback: string
): Promise<PreparedLessonResourceUpload> => {
  const value = await readJson(response);
  const rawReference = isRecord(value)
    ? (value.reference ?? value.resource)
    : undefined;

  if (
    !(response.ok && isRecord(value)) ||
    typeof value.expiresAt !== "string" ||
    typeof value.uploadUrl !== "string" ||
    !isReference(rawReference) ||
    !(
      value.previewUploadUrl === undefined ||
      typeof value.previewUploadUrl === "string"
    )
  ) {
    throw new Error(readSafeError(value, fallback));
  }

  return {
    expiresAt: value.expiresAt,
    ...(value.previewUploadUrl
      ? { previewUploadUrl: value.previewUploadUrl }
      : {}),
    reference: rawReference,
    uploadUrl: value.uploadUrl,
  };
};

const prepareLessonResourceUpload = async ({
  file,
  lessonId,
  onStatus,
  preview,
  signal,
}: {
  file: File;
  lessonId: string;
  onStatus?: ((phase: UploadStatusPhase) => void) | undefined;
  preview: LessonResourceUploadPreview | null | undefined;
  signal?: AbortSignal | undefined;
}): Promise<PreparedLessonResourceUpload> => {
  onStatus?.("preparing");
  const response = await fetch(
    `/api/admin/lessons/${lessonId}/resources/upload-url`,
    {
      body: JSON.stringify({
        contentType: file.type,
        fileName: file.name,
        ...(preview
          ? {
              preview: {
                contentType: preview.contentType,
                height: preview.height,
                sizeBytes: preview.blob.size,
                width: preview.width,
              },
            }
          : {}),
        sizeBytes: file.size,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: signal ?? null,
    }
  );

  return await readPreparedUpload(
    response,
    "Nao foi possivel preparar o upload."
  );
};

const reissueLessonResourceUpload = async ({
  lessonId,
  resourceId,
  signal,
}: {
  lessonId: string;
  resourceId: string;
  signal?: AbortSignal | undefined;
}): Promise<PreparedLessonResourceUpload> => {
  const response = await fetch(
    `/api/admin/lessons/${lessonId}/resources/reissue-url`,
    {
      body: JSON.stringify({ resourceId }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: signal ?? null,
    }
  );

  return await readPreparedUpload(
    response,
    "Nao foi possivel renovar o upload."
  );
};

const assertSamePreparedObject = (
  initial: LessonResourceUploadReference,
  renewed: LessonResourceUploadReference
): void => {
  if (
    initial.id !== renewed.id ||
    initial.key !== renewed.key ||
    initial.contentType !== renewed.contentType ||
    initial.fileName !== renewed.fileName ||
    initial.sizeBytes !== renewed.sizeBytes ||
    JSON.stringify(initial.preview ?? null) !==
      JSON.stringify(renewed.preview ?? null)
  ) {
    throw new InvalidLessonResourceUploadError(
      "O upload renovado nao corresponde ao material preparado."
    );
  }
};

const putExact = async ({
  body,
  contentType,
  onProgress,
  signal,
  uploadUrl,
}: {
  body: Blob;
  contentType: string;
  onProgress?: ((progress: UploadTransferProgress) => void) | undefined;
  signal?: AbortSignal | undefined;
  uploadUrl: string;
}): Promise<void> => {
  try {
    await uploadBlobWithProgress({
      acceptedStatusCodes: [412],
      body,
      headers: { "Content-Type": contentType, "If-None-Match": "*" },
      onProgress,
      signal,
      url: uploadUrl,
    });
  } catch (error) {
    if (isUploadAbortedError(error)) {
      throw error;
    }
    throw new DirectLessonResourceUploadError(
      "O upload direto para o R2 falhou."
    );
  }
};

const uploadPreparedObjects = async ({
  file,
  onProgress,
  prepared,
  preview,
  signal,
}: {
  file: File;
  onProgress?: ((progress: UploadTransferProgress) => void) | undefined;
  prepared: PreparedLessonResourceUpload;
  preview: LessonResourceUploadPreview | null | undefined;
  signal?: AbortSignal | undefined;
}): Promise<void> => {
  const totalBytes = file.size + (preview?.blob.size ?? 0);
  let completedBytes = 0;
  let lastReportedPercentage: number | null | undefined;
  const reportPartProgress =
    () =>
    (progress: UploadTransferProgress): void => {
      const loaded = Math.min(totalBytes, completedBytes + progress.loaded);
      const percentage = Math.min(100, Math.round((loaded / totalBytes) * 100));
      if (percentage === lastReportedPercentage) {
        return;
      }
      lastReportedPercentage = percentage;
      onProgress?.({ loaded, percentage, total: totalBytes });
    };

  await putExact({
    body: file,
    contentType: prepared.reference.contentType,
    onProgress: reportPartProgress(),
    signal,
    uploadUrl: prepared.uploadUrl,
  });
  completedBytes += file.size;

  if (preview) {
    if (!prepared.previewUploadUrl) {
      throw new DirectLessonResourceUploadError(
        "Upload de preview indisponivel."
      );
    }

    await putExact({
      body: preview.blob,
      contentType: preview.contentType,
      onProgress: reportPartProgress(),
      signal,
      uploadUrl: prepared.previewUploadUrl,
    });
    completedBytes += preview.blob.size;
  }
};

const confirmLessonResourceUpload = async ({
  lessonId,
  onStatus,
  resourceId,
  signal,
}: {
  lessonId: string;
  onStatus?: ((phase: UploadStatusPhase) => void) | undefined;
  resourceId: string;
  signal?: AbortSignal | undefined;
}): Promise<LessonResourceUploadReference> => {
  for (
    let attempt = 0;
    attempt < LESSON_UPLOAD_CONFIRMATION_ATTEMPTS;
    attempt += 1
  ) {
    onStatus?.("confirming");
    let response: Response;
    try {
      response = await fetch(
        `/api/admin/lessons/${lessonId}/resources/confirm`,
        {
          body: JSON.stringify({ resourceId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: signal ?? null,
        }
      );
    } catch (error) {
      if (isUploadAbortedError(error, signal)) {
        throw new UploadAbortedError();
      }
      if (
        attempt + 1 < LESSON_UPLOAD_CONFIRMATION_ATTEMPTS &&
        error instanceof TypeError
      ) {
        continue;
      }
      throw new Error("Não foi possível confirmar o anexo. Tente novamente.");
    }

    const value = await readJson(response);
    if (response.ok && isRecord(value) && isReference(value.reference)) {
      return value.reference;
    }

    if (
      attempt + 1 < LESSON_UPLOAD_CONFIRMATION_ATTEMPTS &&
      response.status >= 500
    ) {
      continue;
    }

    throw new Error(
      readSafeError(value, "Nao foi possivel confirmar o upload.")
    );
  }

  throw new Error("Não foi possível confirmar o anexo. Tente novamente.");
};

const uploadThroughServer = async ({
  file,
  lessonId,
  onStatus,
  preview,
  resourceId,
  signal,
}: {
  file: File;
  lessonId: string;
  onStatus?: ((phase: UploadStatusPhase) => void) | undefined;
  preview: LessonResourceUploadPreview | null | undefined;
  resourceId: string;
  signal?: AbortSignal | undefined;
}): Promise<LessonResourceUploadReference> => {
  onStatus?.("fallback");
  const formData = new FormData();
  formData.set("file", file);
  formData.set("resourceId", resourceId);
  if (preview) {
    formData.set(
      "preview",
      new File([preview.blob], "preview.webp", { type: preview.contentType })
    );
  }

  const response = await fetch(
    `/api/admin/lessons/${lessonId}/resources/upload`,
    { body: formData, method: "POST", signal: signal ?? null }
  );
  const value = await readJson(response);

  if (!(response.ok && isRecord(value) && isReference(value.reference))) {
    throw new Error(
      readSafeError(value, "Nao foi possivel concluir o upload pelo servidor.")
    );
  }

  return value.reference;
};

export const uploadLessonResource = async ({
  file,
  lessonId,
  onStatus,
  onProgress,
  preview,
  signal,
}: {
  file: File;
  lessonId: string;
  onStatus?: ((phase: UploadStatusPhase) => void) | undefined;
  onProgress?: ((progress: UploadTransferProgress) => void) | undefined;
  preview?: LessonResourceUploadPreview | null;
  signal?: AbortSignal | undefined;
}): Promise<LessonResourceUploadReference> => {
  validateLessonAttachmentUpload({
    contentType: file.type,
    fileName: file.name,
    sizeBytes: file.size,
  });

  let initial: PreparedLessonResourceUpload;
  try {
    initial = await prepareLessonResourceUpload({
      file,
      lessonId,
      onStatus,
      preview,
      signal,
    });
  } catch (error) {
    if (isUploadAbortedError(error, signal)) {
      throw new UploadAbortedError();
    }
    throw error;
  }

  let resourceId = initial.reference.id;
  onStatus?.("uploading");
  try {
    await uploadPreparedObjects({
      file,
      onProgress,
      prepared: initial,
      preview,
      signal,
    });
  } catch (error) {
    if (isUploadAbortedError(error, signal)) {
      throw new UploadAbortedError();
    }
    onStatus?.("retrying");
    let renewed: PreparedLessonResourceUpload;

    try {
      renewed = await reissueLessonResourceUpload({
        lessonId,
        resourceId: initial.reference.id,
        signal,
      });
      assertSamePreparedObject(initial.reference, renewed.reference);
      onStatus?.("uploading");
      await uploadPreparedObjects({
        file,
        onProgress,
        prepared: renewed,
        preview,
        signal,
      });
      resourceId = renewed.reference.id;
    } catch (error) {
      if (isUploadAbortedError(error, signal)) {
        throw new UploadAbortedError();
      }
      if (error instanceof InvalidLessonResourceUploadError) {
        throw error;
      }

      if (file.size <= LESSON_SERVER_FALLBACK_MAX_BYTES) {
        return await uploadThroughServer({
          file,
          lessonId,
          onStatus,
          preview,
          resourceId: initial.reference.id,
          signal,
        });
      }

      throw new Error(
        "O R2 recusou o upload. Atualize a página e tente novamente."
      );
    }
  }

  return await confirmLessonResourceUpload({
    lessonId,
    onStatus,
    resourceId,
    signal,
  });
};
