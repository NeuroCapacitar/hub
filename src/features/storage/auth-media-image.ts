import sharp, { type Metadata } from "sharp";
import {
  AUTH_MEDIA_IMAGE_HEIGHT,
  AUTH_MEDIA_IMAGE_WIDTH,
  validateAuthMediaSourceRequest,
} from "./auth-media-image-contract";

const AUTH_MEDIA_FINAL_CONTENT_TYPE = "image/webp";

export const validateAuthMediaImageFile = async (file: File): Promise<void> => {
  if (file.type !== AUTH_MEDIA_FINAL_CONTENT_TYPE) {
    throw new Error("A mídia da tela de acesso deve estar em WebP.");
  }

  validateAuthMediaSourceRequest({
    contentType: file.type,
    sizeBytes: file.size,
  });

  let metadata: Metadata;
  try {
    metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
  } catch {
    throw new Error("Não foi possível ler a mídia da tela de acesso.");
  }

  if (
    metadata.format !== "webp" ||
    metadata.width !== AUTH_MEDIA_IMAGE_WIDTH ||
    metadata.height !== AUTH_MEDIA_IMAGE_HEIGHT
  ) {
    throw new Error(
      `A mídia da tela de acesso deve ter ${AUTH_MEDIA_IMAGE_WIDTH} × ${AUTH_MEDIA_IMAGE_HEIGHT} px em WebP.`
    );
  }
};

export const createAuthMediaBlurDataUrl = async (
  file: File
): Promise<string> => {
  const blurBuffer = await sharp(Buffer.from(await file.arrayBuffer()))
    .resize({ width: 12 })
    .webp({ quality: 20 })
    .toBuffer();

  return `data:image/webp;base64,${blurBuffer.toString("base64")}`;
};
