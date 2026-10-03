import { describe, expect, it, vi } from "vitest";
import { readBoundedBody, readBoundedMultipart } from "./request-body-limits";

describe("bounded upload bodies", () => {
  it("cancels a streamed body when actual bytes exceed the cap", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(3));
        controller.enqueue(new Uint8Array(3));
      },
      cancel,
    });
    await expect(readBoundedBody(stream, 5)).rejects.toMatchObject({
      status: 413,
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    null,
    "1",
  ])("counts surplus multipart fields with declared length %s", async (length) => {
    const form = new FormData();
    form.set("file", new File(["ok"], "ok.png", { type: "image/png" }));
    form.set("unused", "x".repeat(2048));
    const request = new Request("https://example.test/upload", {
      body: form,
      method: "POST",
    });
    if (length) {
      request.headers.set("content-length", length);
    }
    await expect(readBoundedMultipart(request, 1024)).rejects.toMatchObject({
      status: 413,
    });
  });

  it("parses a body within the limit", async () => {
    const form = new FormData();
    form.set("label", "valid");
    const parsed = await readBoundedMultipart(
      new Request("https://example.test/upload", {
        body: form,
        method: "POST",
      }),
      1024
    );
    expect(parsed.get("label")).toBe("valid");
  });

  it("times out and cancels a stalled body", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const stream = new ReadableStream<Uint8Array>({ cancel });
      const assertion = expect(
        readBoundedBody(stream, 1024, 20)
      ).rejects.toMatchObject({ status: 408 });
      await vi.advanceTimersByTimeAsync(20);
      await assertion;
      expect(cancel).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
