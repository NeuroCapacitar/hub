import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("R2 import boundary", () => {
  it("does not load image processors until an upload needs them", async () => {
    vi.resetModules();
    vi.doMock("sharp", () => {
      throw new Error("Sharp must not load in read-only R2 consumers.");
    });

    try {
      await expect(import("./r2")).resolves.toBeDefined();
    } finally {
      vi.doUnmock("sharp");
      vi.resetModules();
    }
  });
});
