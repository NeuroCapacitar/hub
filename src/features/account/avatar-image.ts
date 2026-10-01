import "server-only";
import sharp, { type Metadata } from "sharp";
import { USER_AVATAR_MAX_BYTES, USER_AVATAR_SIZE } from "./avatar-policy";

const MAX_SOURCE_DIMENSION = 8192;
const MAX_SOURCE_PIXELS = 24_000_000;
const SOURCE_FORMATS = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export interface ProcessedUserAvatar {
  body: Buffer;
  contentType: "image/webp";
  height: number;
  width: number;
}

export class AvatarImageValidationError extends Error {}

const readMetadata = async (buffer: Buffer): Promise<Metadata> => {
  try {
    return await sharp(buffer, {
      failOn: "error",
      limitInputPixels: MAX_SOURCE_PIXELS,
    }).metadata();
  } catch {
    throw new AvatarImageValidationError(
      "Não foi possível ler este arquivo como imagem."
    );
  }
};

export const processUserAvatarImage = async (
  file: File
): Promise<ProcessedUserAvatar> => {
  if (!Object.hasOwn(SOURCE_FORMATS, file.type)) {
    throw new AvatarImageValidationError("Envie uma imagem JPG, PNG ou WebP.");
  }
  if (!(Number.isInteger(file.size) && file.size > 0)) {
    throw new AvatarImageValidationError(
      "O arquivo de imagem está vazio ou é inválido."
    );
  }
  if (file.size > USER_AVATAR_MAX_BYTES) {
    throw new AvatarImageValidationError(
      "A imagem não pode ter mais de 5 MiB."
    );
  }

  const input = Buffer.from(await file.arrayBuffer());
  if (input.length !== file.size) {
    throw new AvatarImageValidationError("O arquivo enviado está incompleto.");
  }
  const metadata = await readMetadata(input);
  const expectedFormat =
    SOURCE_FORMATS[file.type as keyof typeof SOURCE_FORMATS];
  if (
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_SOURCE_DIMENSION ||
    metadata.height > MAX_SOURCE_DIMENSION ||
    metadata.width * metadata.height > MAX_SOURCE_PIXELS ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new AvatarImageValidationError(
      "A imagem precisa ser JPG, PNG ou WebP estático, com no máximo 8192 px por lado."
    );
  }

  let body: Buffer;
  try {
    body = await sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_SOURCE_PIXELS,
    })
      .rotate()
      .resize(USER_AVATAR_SIZE, USER_AVATAR_SIZE, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AvatarImageValidationError(
      "Não foi possível preparar a imagem de perfil."
    );
  }

  return {
    body,
    contentType: "image/webp",
    height: USER_AVATAR_SIZE,
    width: USER_AVATAR_SIZE,
  };
};
