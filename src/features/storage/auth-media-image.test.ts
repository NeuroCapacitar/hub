import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createAuthMediaBlurDataUrl,
  validateAuthMediaImageFile,
} from "./auth-media-image";
import {
  AUTH_MEDIA_IMAGE_ASPECT_RATIO,
  AUTH_MEDIA_IMAGE_HEIGHT,
  AUTH_MEDIA_IMAGE_WIDTH,
  validateAuthMediaSourceRequest,
} from "./auth-media-image-contract";

const createAuthMediaFile = async ({
  height = AUTH_MEDIA_IMAGE_HEIGHT,
  width = AUTH_MEDIA_IMAGE_WIDTH,
}: {
  height?: number;
  width?: number;
} = {}): Promise<File> => {
  const buffer = await sharp({
    create: {
      background: "#234e52",
      channels: 3,
      height,
      width,
    },
  })
    .webp({ quality: 90 })
    .toBuffer();

  return new File([new Uint8Array(buffer)], "auth-media.webp", {
    type: "image/webp",
  });
};

describe("auth media image contract", () => {
  it("accepts a canonical 1200 by 1050 WebP", async () => {
    expect(AUTH_MEDIA_IMAGE_ASPECT_RATIO).toBe(8 / 7);
    await expect(
      validateAuthMediaImageFile(await createAuthMediaFile())
    ).resolves.toBeUndefined();
  });

  it("rejects a final image with the wrong dimensions", async () => {
    await expect(
      validateAuthMediaImageFile(await createAuthMediaFile({ height: 1499 }))
    ).rejects.toThrow(
      "A mídia da tela de acesso deve ter 1200 × 1050 px em WebP."
    );
  });

  it("rejects source files over the server-side limit", () => {
    expect(() =>
      validateAuthMediaSourceRequest({
        contentType: "image/jpeg",
        sizeBytes: 5 * 1024 * 1024 + 1,
      })
    ).toThrow("A imagem não pode ter mais de 5 MiB.");
  });

  it("creates a compact WebP blur data URL", async () => {
    const blurDataUrl = await createAuthMediaBlurDataUrl(
      await createAuthMediaFile()
    );
    const blurBuffer = Buffer.from(blurDataUrl.split(",")[1] ?? "", "base64");
    const metadata = await sharp(blurBuffer).metadata();

    expect(blurDataUrl.startsWith("data:image/webp;base64,")).toBe(true);
    expect(metadata.width).toBeLessThanOrEqual(12);
  });
});
