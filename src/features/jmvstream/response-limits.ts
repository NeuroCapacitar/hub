export const JMVSTREAM_REQUEST_TIMEOUT_MS = 15_000;
export const JMVSTREAM_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export const readBoundedJmvstreamResponse = async (
  response: Response
): Promise<string> => {
  const declaredSize = Number(response.headers.get("content-length"));
  if (declaredSize > JMVSTREAM_MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error("Resposta JMVStream excede o limite permitido.");
  }
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return text + decoder.decode();
      }
      size += value.byteLength;
      if (size > JMVSTREAM_MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Resposta JMVStream excede o limite permitido.");
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
};
