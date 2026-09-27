import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createCourseCoverUploadParts,
  readCourseCoverFile,
} from "./course-cover-upload";

const createImageFile = async ({
  contentType = "image/png",
  fileName = "cover.png",
  height = 720,
  width = 1280,
}: {
  contentType?: string;
  fileName?: string;
  height?: number;
  width?: number;
} = {}): Promise<File> => {
  const buffer = await sharp({
    create: {
      background: "#326c71",
      channels: 3,
      height,
      width,
    },
  })
    .png()
    .toBuffer();

  return new File([new Uint8Array(buffer)], fileName, { type: contentType });
};

describe("course cover upload", () => {
  it("treats an empty form file as no replacement", () => {
    const file = new File([], "", { type: "application/octet-stream" });

    expect(readCourseCoverFile(file)).toBeNull();
  });

  it("treats a phantom multipart file as no replacement", () => {
    const file = new File([], "undefined", {
      type: "application/octet-stream",
    });

    expect(readCourseCoverFile(file)).toBeNull();
  });

  it("rejects invalid cover files before processing", async () => {
    const invalidType = new File(["<svg />"], "cover.png", {
      type: "image/svg+xml",
    });

    expect(() => readCourseCoverFile(invalidType)).toThrow(
      "Tipo de imagem nao permitido."
    );

    const oversized = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "x.png", {
      type: "image/png",
    });

    expect(() => readCourseCoverFile(oversized)).toThrow(
      "Imagem maior que 4 MiB."
    );

    const invalidExtension = await createImageFile({
      fileName: "cover.gif",
    });

    expect(() => readCourseCoverFile(invalidExtension)).toThrow(
      "Extensao de imagem nao permitida."
    );
  });

  it("creates one optimized 16:9 image and a blur placeholder", async () => {
    const file = await createImageFile();
    const coverFile = readCourseCoverFile(file);

    expect(coverFile).not.toBeNull();

    const parts = await createCourseCoverUploadParts({
      courseId: "course-1",
      file: coverFile,
      nonce: "upload-1",
    });

    expect(parts.coverImage.variants.card).toMatchObject({
      contentType: "image/webp",
      height: 720,
      key: "courses/course-1/cover/upload-1-card.webp",
      width: 1280,
    });
    expect(
      parts.coverImage.blurDataUrl?.startsWith("data:image/webp;base64,")
    ).toBe(true);
    const blurBuffer = Buffer.from(
      parts.coverImage.blurDataUrl?.split(",")[1] ?? "",
      "base64"
    );
    const blurMetadata = await sharp(blurBuffer).metadata();
    expect(blurMetadata.width).toBeLessThanOrEqual(10);
    expect(parts.objects).toHaveLength(1);
    expect(parts.objects[0]?.key).toBe(
      "courses/course-1/cover/upload-1-card.webp"
    );
    expect(parts.objects.every((object) => object.body.length > 0)).toBe(true);
    expect(parts.coverImage.original).toBeUndefined();
    expect(parts.coverImage.variants.thumb).toBeUndefined();
  });
});
