import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadAbortedError, uploadBlobWithProgress } from "./xhr-upload";

const xhrInstances: FakeXMLHttpRequest[] = [];

class FakeXMLHttpRequest extends EventTarget {
  readonly headers = new Map<string, string>();
  readonly upload = new EventTarget();
  body: Blob | null = null;
  method = "";
  status = 200;
  abortCalls = 0;
  url = "";

  constructor() {
    super();
    xhrInstances.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  send(body: Blob): void {
    this.body = body;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  abort(): void {
    this.abortCalls += 1;
    this.dispatchEvent(new Event("abort"));
  }
}

const progressEvent = (
  loaded: number,
  total: number,
  lengthComputable = true
): ProgressEvent =>
  Object.assign(new Event("progress"), {
    lengthComputable,
    loaded,
    total,
  }) as ProgressEvent;

describe("uploadBlobWithProgress", () => {
  beforeEach(() => {
    xhrInstances.length = 0;
    vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the original Blob with the signed request headers", async () => {
    const blob = new Blob(["image"], { type: "image/webp" });

    const upload = uploadBlobWithProgress({
      body: blob,
      headers: { "Content-Type": "image/webp" },
      url: "https://r2.example.test/signed-put",
    });

    const xhr = xhrInstances[0];
    expect(xhr?.method).toBe("PUT");
    expect(xhr?.url).toBe("https://r2.example.test/signed-put");
    expect(xhr?.headers.get("Content-Type")).toBe("image/webp");
    expect(xhr?.body).toBe(blob);

    xhr?.dispatchEvent(new Event("load"));
    await expect(upload).resolves.toBeUndefined();
  });

  it("reports measurable progress and completes at 100 percent", async () => {
    const onProgress = vi.fn();
    const upload = uploadBlobWithProgress({
      body: new Blob(["1234"]),
      onProgress,
      url: "https://r2.example.test/signed-put",
    });
    const xhr = xhrInstances[0];

    xhr?.upload.dispatchEvent(progressEvent(2, 4));
    expect(onProgress).toHaveBeenLastCalledWith({
      loaded: 2,
      percentage: 50,
      total: 4,
    });

    xhr?.dispatchEvent(new Event("load"));
    await expect(upload).resolves.toBeUndefined();
    expect(onProgress).toHaveBeenLastCalledWith({
      loaded: 4,
      percentage: 100,
      total: 4,
    });
  });

  it("reports only meaningful percentage changes", async () => {
    const onProgress = vi.fn();
    const upload = uploadBlobWithProgress({
      body: new Blob(["1234"]),
      onProgress,
      url: "https://r2.example.test/signed-put",
    });
    const xhr = xhrInstances[0];

    xhr?.upload.dispatchEvent(progressEvent(1, 4));
    xhr?.upload.dispatchEvent(progressEvent(1.01, 4));
    xhr?.upload.dispatchEvent(progressEvent(2, 4));

    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { loaded: 1, percentage: 25, total: 4 },
      { loaded: 2, percentage: 50, total: 4 },
    ]);

    xhr?.dispatchEvent(new Event("load"));
    await expect(upload).resolves.toBeUndefined();
    expect(onProgress).toHaveBeenLastCalledWith({
      loaded: 4,
      percentage: 100,
      total: 4,
    });
  });

  it("reports indeterminate progress when the browser cannot compute a total", async () => {
    const onProgress = vi.fn();
    const upload = uploadBlobWithProgress({
      body: new Blob(["1234"]),
      onProgress,
      url: "https://r2.example.test/signed-put",
    });
    const xhr = xhrInstances[0];

    xhr?.upload.dispatchEvent(progressEvent(2, 0, false));
    expect(onProgress).toHaveBeenLastCalledWith({
      loaded: 2,
      percentage: null,
      total: null,
    });

    xhr?.dispatchEvent(new Event("load"));
    await expect(upload).resolves.toBeUndefined();
  });

  it("rejects a failed HTTP upload without exposing the signed URL", async () => {
    const upload = uploadBlobWithProgress({
      body: new Blob(["image"]),
      url: "https://r2.example.test/signed-put?X-Amz-Signature=secret",
    });
    const xhr = xhrInstances[0];
    if (xhr) {
      xhr.status = 403;
      xhr.dispatchEvent(new Event("load"));
    }

    await expect(upload).rejects.toThrow("R2 recusou o upload direto");
    await expect(upload).rejects.not.toThrow("X-Amz-Signature");
  });

  it("aborts the underlying request when its signal is aborted", async () => {
    const controller = new AbortController();
    const upload = uploadBlobWithProgress({
      body: new Blob(["image"]),
      signal: controller.signal,
      url: "https://r2.example.test/signed-put",
    });
    const xhr = xhrInstances[0];

    controller.abort();

    expect(xhr?.abortCalls).toBe(1);
    await expect(upload).rejects.toBeInstanceOf(UploadAbortedError);
  });

  it("does not send a request when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const upload = uploadBlobWithProgress({
      body: new Blob(["image"]),
      signal: controller.signal,
      url: "https://r2.example.test/signed-put",
    });

    await expect(upload).rejects.toBeInstanceOf(UploadAbortedError);
    expect(xhrInstances).toHaveLength(0);
  });
});
