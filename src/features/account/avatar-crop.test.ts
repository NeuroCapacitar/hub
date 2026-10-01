/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createUserAvatarCropFile } from "./avatar-crop";

class TestImage {
  private readonly listeners = new Map<string, (event: Event) => void>();

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject
  ): void {
    if (typeof listener === "function") {
      this.listeners.set(type, listener as (event: Event) => void);
    }
  }

  set src(_value: string) {
    this.listeners.get("load")?.(new Event("load"));
  }
}

describe("createUserAvatarCropFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["image/webp", "profile-avatar.webp"],
    ["image/png", "profile-avatar.png"],
  ])("creates a square file that matches the encoded %s format", async (type, name) => {
    const context = { drawImage: vi.fn() };
    const canvas = {
      getContext: vi.fn(() => context),
      height: 0,
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(new Blob(["cropped"], { type }));
      }),
      width: 0,
    } as unknown as HTMLCanvasElement;
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) =>
      tagName === "canvas" ? canvas : createElement(tagName)
    );
    vi.stubGlobal("Image", TestImage);

    const file = await createUserAvatarCropFile({
      crop: { height: 320, width: 320, x: 20, y: 30 },
      sourceUrl: "blob:avatar-source",
    });

    expect(canvas.width).toBe(512);
    expect(canvas.height).toBe(512);
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.any(TestImage),
      20,
      30,
      320,
      320,
      0,
      0,
      512,
      512
    );
    expect(file.type).toBe(type);
    expect(file.name).toBe(name);
  });

  it("does not mislabel an unsupported canvas output format", async () => {
    const canvas = {
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      height: 0,
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(new Blob(["cropped"], { type: "image/jpeg" }));
      }),
      width: 0,
    } as unknown as HTMLCanvasElement;
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) =>
      tagName === "canvas" ? canvas : createElement(tagName)
    );
    vi.stubGlobal("Image", TestImage);

    await expect(
      createUserAvatarCropFile({
        crop: { height: 320, width: 320, x: 0, y: 0 },
        sourceUrl: "blob:avatar-source",
      })
    ).rejects.toThrow("Não foi possível preparar a foto neste navegador");
  });
});
