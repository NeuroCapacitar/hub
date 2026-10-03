export class RequestBodyLimitError extends Error {
  readonly status: 408 | 413;

  constructor(status: 408 | 413) {
    super(
      status === 413 ? "Request body exceeds limit." : "Request body timed out."
    );
    this.status = status;
  }
}

export const MULTIPART_OVERHEAD_MAX_BYTES = 1024 * 1024;

export const readBoundedBody = async (
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  timeoutMs = 15_000
): Promise<Uint8Array<ArrayBuffer>> => {
  if (!body) {
    return new Uint8Array(0);
  }
  const reader = body.getReader();
  const bytes = new Uint8Array(maxBytes);
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new RequestBodyLimitError(408)), timeoutMs);
  });
  const read = async (): Promise<Uint8Array<ArrayBuffer>> => {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      if (result.value.byteLength > maxBytes - size) {
        throw new RequestBodyLimitError(413);
      }
      bytes.set(result.value, size);
      size += result.value.byteLength;
    }
    return bytes.subarray(0, size);
  };
  try {
    return await Promise.race([read(), deadline]);
  } catch (error) {
    reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
};

export const readBoundedMultipart = async (
  request: Request,
  maxBytes: number
): Promise<FormData> => {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    request.body?.cancel().catch(() => undefined);
    throw new RequestBodyLimitError(413);
  }
  const bytes = await readBoundedBody(request.body, maxBytes);
  return await new Response(bytes, {
    headers: { "content-type": request.headers.get("content-type") ?? "" },
  }).formData();
};
