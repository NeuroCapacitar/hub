import { describe, expect, it } from "vitest";
import {
  JMVSTREAM_MAX_RESPONSE_BYTES,
  readBoundedJmvstreamResponse,
} from "./response-limits";

describe("bounded JMVStream responses", () => {
  it("reads a normal provider body", async () => {
    await expect(
      readBoundedJmvstreamResponse(new Response('{"status":"ready"}'))
    ).resolves.toBe('{"status":"ready"}');
  });
  it("rejects a declared oversized body before consuming it", async () => {
    await expect(
      readBoundedJmvstreamResponse(
        new Response("", {
          headers: {
            "content-length": String(JMVSTREAM_MAX_RESPONSE_BYTES + 1),
          },
        })
      )
    ).rejects.toThrow("limite");
  });
  it("rejects an oversized stream even when the length header is absent", async () => {
    await expect(
      readBoundedJmvstreamResponse(
        new Response(new Uint8Array(JMVSTREAM_MAX_RESPONSE_BYTES + 1))
      )
    ).rejects.toThrow("limite");
  });
});
