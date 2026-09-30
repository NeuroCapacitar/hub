import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AvatarImageValidationError,
  processUserAvatarImage,
} from "./avatar-image";
import { USER_AVATAR_SIZE } from "./avatar-policy";

const createPngFile = async ({
  height = 40,
  width = 80,
}: {
  height?: number;
  width?: number;
} = {}): Promise<File> => {
  const image = await sharp({
    create: {
      background: { b: 180, g: 120, r: 55 },
      channels: 3,
      height,
      width,
    },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(image)], "profile.png", {
    type: "image/png",
  });
};

describe("user avatar image processing", () => {
  it("decodes the real image, center-crops, and normalizes to private WebP", async () => {
    const processed = await processUserAvatarImage(await createPngFile());
    const metadata = await sharp(processed.body).metadata();

    expect(processed).toMatchObject({
      contentType: "image/webp",
      height: USER_AVATAR_SIZE,
      width: USER_AVATAR_SIZE,
    });
    expect(metadata).toMatchObject({
      format: "webp",
      height: USER_AVATAR_SIZE,
      width: USER_AVATAR_SIZE,
    });
  });

  it("rejects spoofed MIME types, unsupported files, and oversized input", async () => {
    const image = await sharp({
      create: {
        background: { b: 1, g: 2, r: 3 },
        channels: 3,
        height: 20,
        width: 20,
      },
    })
      .png()
      .toBuffer();
    const spoofed = new File([new Uint8Array(image)], "photo.jpg", {
      type: "image/jpeg",
    });
    const unsupported = new File([new Uint8Array(image)], "vector.svg", {
      type: "image/svg+xml",
    });
    const oversized = new File(
      [new Uint8Array(5 * 1024 * 1024 + 1)],
      "large.webp",
      { type: "image/webp" }
    );

    await expect(processUserAvatarImage(spoofed)).rejects.toBeInstanceOf(
      AvatarImageValidationError
    );
    await expect(processUserAvatarImage(unsupported)).rejects.toBeInstanceOf(
      AvatarImageValidationError
    );
    await expect(processUserAvatarImage(oversized)).rejects.toBeInstanceOf(
      AvatarImageValidationError
    );
  });

  it("rejects excessive source dimensions before resizing", async () => {
    const image = await sharp({
      create: {
        background: { b: 0, g: 0, r: 0 },
        channels: 3,
        height: 1,
        width: 8193,
      },
    })
      .png()
      .toBuffer();
    const file = new File([new Uint8Array(image)], "wide.png", {
      type: "image/png",
    });

    await expect(processUserAvatarImage(file)).rejects.toThrow("8192 px");
  });
});
