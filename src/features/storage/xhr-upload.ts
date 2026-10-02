export interface UploadTransferProgress {
  loaded: number;
  percentage: number | null;
  total: number | null;
}

export type UploadStatusPhase =
  | "confirming"
  | "fallback"
  | "preparing"
  | "retrying"
  | "saving"
  | "uploading";

export interface UploadBlobWithProgressInput {
  acceptedStatusCodes?: readonly number[];
  body: Blob;
  headers?: Record<string, string>;
  onProgress?: ((progress: UploadTransferProgress) => void) | undefined;
  signal?: AbortSignal | undefined;
  url: string;
}

export class UploadAbortedError extends Error {
  constructor() {
    super("O envio foi cancelado.");
    this.name = "AbortError";
  }
}

export const isUploadAbortedError = (
  error: unknown,
  signal?: AbortSignal | undefined
): boolean =>
  signal?.aborted === true ||
  error instanceof UploadAbortedError ||
  (typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError");

const FAILED_MESSAGE = "Não foi possível concluir o envio direto do arquivo.";

const getTransferProgress = (event: Event): UploadTransferProgress => {
  const progressEvent = event as ProgressEvent;
  const total =
    progressEvent.lengthComputable && progressEvent.total > 0
      ? progressEvent.total
      : null;
  const percentage =
    total === null
      ? null
      : Math.min(100, Math.round((progressEvent.loaded / total) * 100));

  return { loaded: progressEvent.loaded, percentage, total };
};

const shouldReportProgress = (
  percentage: number | null,
  lastReportedPercentage: number | null | undefined,
  reportedIndeterminateProgress: boolean
): boolean =>
  percentage === null
    ? !reportedIndeterminateProgress
    : percentage !== lastReportedPercentage;

export const uploadBlobWithProgress = (
  input: UploadBlobWithProgressInput
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(new UploadAbortedError());
      return;
    }

    const request = new XMLHttpRequest();
    let settled = false;
    let lastReportedPercentage: number | null | undefined;
    let reportedIndeterminateProgress = false;

    const cleanup = (): void => {
      input.signal?.removeEventListener("abort", abortRequest);
      request.upload.removeEventListener("progress", reportProgress);
      request.removeEventListener("load", handleLoad);
      request.removeEventListener("error", handleError);
      request.removeEventListener("timeout", handleError);
      request.removeEventListener("abort", handleAbort);
    };

    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const reportProgress = (event: Event): void => {
      const progress = getTransferProgress(event);
      if (
        !shouldReportProgress(
          progress.percentage,
          lastReportedPercentage,
          reportedIndeterminateProgress
        )
      ) {
        return;
      }
      if (progress.percentage === null) {
        reportedIndeterminateProgress = true;
      } else {
        lastReportedPercentage = progress.percentage;
      }

      try {
        input.onProgress?.(progress);
      } catch (error) {
        finish(error instanceof Error ? error : new Error(FAILED_MESSAGE));
        request.abort();
      }
    };

    const handleLoad = (): void => {
      const succeeded = request.status >= 200 && request.status < 300;
      if (!(succeeded || input.acceptedStatusCodes?.includes(request.status))) {
        finish(new Error("R2 recusou o upload direto."));
        return;
      }

      if (lastReportedPercentage !== 100) {
        try {
          input.onProgress?.({
            loaded: input.body.size,
            percentage: 100,
            total: input.body.size,
          });
          lastReportedPercentage = 100;
        } catch (error) {
          finish(error instanceof Error ? error : new Error(FAILED_MESSAGE));
          return;
        }
      }

      finish();
    };

    const handleError = (): void => finish(new Error(FAILED_MESSAGE));
    const handleAbort = (): void => finish(new UploadAbortedError());
    const abortRequest = (): void => request.abort();

    request.addEventListener("load", handleLoad);
    request.addEventListener("error", handleError);
    request.addEventListener("timeout", handleError);
    request.addEventListener("abort", handleAbort);
    request.upload.addEventListener("progress", reportProgress);
    input.signal?.addEventListener("abort", abortRequest, { once: true });

    try {
      request.open("PUT", input.url);
      request.timeout = 0;
      for (const [name, value] of Object.entries(input.headers ?? {})) {
        request.setRequestHeader(name, value);
      }
      request.send(input.body);
    } catch {
      finish(new Error(FAILED_MESSAGE));
    }
  });
