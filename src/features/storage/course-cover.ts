import { sanitizeR2FileName } from "@/features/storage/r2-objects";

export const COURSE_COVER_CARD_WIDTH = 1280;
export const COURSE_COVER_CARD_HEIGHT = 720;
export const COURSE_COVER_STORAGE_PREFIX = "courses/";
export const COURSE_COVER_ASPECT_RATIO =
  COURSE_COVER_CARD_WIDTH / COURSE_COVER_CARD_HEIGHT;

export const COURSE_COVER_VARIANTS = {
  card: {
    height: COURSE_COVER_CARD_HEIGHT,
    width: COURSE_COVER_CARD_WIDTH,
  },
} as const;

export type CourseCoverOutputVariant = keyof typeof COURSE_COVER_VARIANTS;
export type CourseCoverVariant = CourseCoverOutputVariant | "thumb";

export const COURSE_COVER_ACCEPT = ".jpg,.jpeg,.png,.webp";

export const MAX_COURSE_COVER_UPLOAD_BYTES = 4 * 1024 * 1024;
export const COURSE_COVER_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const ALLOWED_UPLOAD_TYPES = new Set<string>(
  COURSE_COVER_ALLOWED_CONTENT_TYPES
);
const ALLOWED_UPLOAD_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export const isCourseCoverUploadContentType = (value: string): boolean =>
  ALLOWED_UPLOAD_TYPES.has(value);

export interface CourseCoverOriginal {
  contentType: string;
  fileName: string;
  key: string;
  sizeBytes: number;
}

export interface CourseCoverVariantImage {
  contentType: string;
  height: number;
  key: string;
  sizeBytes: number;
  width: number;
}

export interface CourseCoverImage {
  blurDataUrl?: string;
  original?: CourseCoverOriginal;
  variants: Partial<Record<CourseCoverVariant, CourseCoverVariantImage>>;
}

interface CourseCoverUploadRequest {
  courseId: string;
  upload: {
    contentType: string;
    fileName: string;
    sizeBytes: number;
  };
  variants: Array<{
    contentType: string;
    sizeBytes: number;
    variant: string;
  }>;
}

const generatedVariants = Object.keys(
  COURSE_COVER_VARIANTS
) as CourseCoverOutputVariant[];
const readableVariants: CourseCoverVariant[] = ["card", "thumb"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const getFileExtension = (fileName: string): string | null => {
  const sanitized = sanitizeR2FileName(fileName);
  const extension = sanitized.split(".").pop();

  return extension && extension !== sanitized ? extension : null;
};

export const isCourseCoverVariant = (
  value: string
): value is CourseCoverVariant => value === "card" || value === "thumb";

export const buildCourseCoverObjectKey = ({
  courseId,
  extension,
  nonce,
  variant,
}: {
  courseId: string;
  extension: string;
  nonce: string;
  variant: CourseCoverOutputVariant;
}): string =>
  `${COURSE_COVER_STORAGE_PREFIX}${courseId}/cover/${nonce}-${variant}.${sanitizeR2FileName(extension).replaceAll(".", "")}`;

export const isCourseCoverStorageKey = (key: string): boolean =>
  key.startsWith(COURSE_COVER_STORAGE_PREFIX) &&
  key.includes("/cover/") &&
  !key.includes("..") &&
  !key.includes("\\");

const validateCourseCoverUpload = (
  upload: CourseCoverUploadRequest["upload"]
): void => {
  if (!upload.fileName.trim()) {
    throw new Error("Informe o nome da imagem.");
  }

  const extension = getFileExtension(upload.fileName);

  if (!(extension && ALLOWED_UPLOAD_EXTENSIONS.has(extension))) {
    throw new Error("Extensao de imagem nao permitida.");
  }

  if (!ALLOWED_UPLOAD_TYPES.has(upload.contentType)) {
    throw new Error("Tipo de imagem nao permitido.");
  }

  if (!(Number.isInteger(upload.sizeBytes) && upload.sizeBytes > 0)) {
    throw new Error("Tamanho da imagem invalido.");
  }

  if (upload.sizeBytes > MAX_COURSE_COVER_UPLOAD_BYTES) {
    throw new Error("Imagem maior que 4 MiB.");
  }
};

export const validateCourseCoverUploadRequest = ({
  courseId,
  upload,
  variants,
}: CourseCoverUploadRequest): void => {
  if (!courseId.trim()) {
    throw new Error("Curso invalido.");
  }

  validateCourseCoverUpload(upload);

  const variantNames = new Set(variants.map(({ variant }) => variant));

  if (!generatedVariants.every((variant) => variantNames.has(variant))) {
    throw new Error("Envie a imagem final da capa.");
  }

  for (const candidate of variants) {
    if (
      !(
        isCourseCoverVariant(candidate.variant) &&
        generatedVariants.includes(
          candidate.variant as CourseCoverOutputVariant
        )
      )
    ) {
      throw new Error("Variante de capa invalida.");
    }

    if (candidate.contentType !== "image/webp") {
      throw new Error("Tipo de variante de capa invalido.");
    }

    if (!(Number.isInteger(candidate.sizeBytes) && candidate.sizeBytes > 0)) {
      throw new Error("Tamanho da variante invalido.");
    }
  }
};

const parseOriginal = (value: unknown): CourseCoverOriginal | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !(
      typeof value.contentType === "string" &&
      typeof value.fileName === "string" &&
      typeof value.key === "string" &&
      isPositiveInteger(value.sizeBytes)
    )
  ) {
    return null;
  }

  return {
    contentType: value.contentType,
    fileName: value.fileName,
    key: value.key,
    sizeBytes: value.sizeBytes,
  };
};

const parseVariantImage = (value: unknown): CourseCoverVariantImage | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !(
      typeof value.contentType === "string" &&
      typeof value.key === "string" &&
      isPositiveInteger(value.height) &&
      isPositiveInteger(value.sizeBytes) &&
      isPositiveInteger(value.width)
    )
  ) {
    return null;
  }

  return {
    contentType: value.contentType,
    height: value.height,
    key: value.key,
    sizeBytes: value.sizeBytes,
    width: value.width,
  };
};

export const parseCourseCoverImage = (
  value: unknown
): CourseCoverImage | null => {
  if (!isRecord(value)) {
    return null;
  }

  const original = parseOriginal(value.original);

  if (!isRecord(value.variants)) {
    return null;
  }

  const variants: CourseCoverImage["variants"] = {};

  for (const variant of readableVariants) {
    const image = parseVariantImage(value.variants[variant]);

    if (image) {
      variants[variant] = image;
    }
  }

  if (!variants.card) {
    return null;
  }

  return {
    ...(typeof value.blurDataUrl === "string"
      ? { blurDataUrl: value.blurDataUrl }
      : {}),
    ...(original ? { original } : {}),
    variants,
  };
};

export const getCourseCoverBlurDataUrl = (coverImage: unknown): string | null =>
  parseCourseCoverImage(coverImage)?.blurDataUrl ?? null;

export const getCourseCoverVariantPath = ({
  courseId,
  coverImage,
  variant,
}: {
  courseId: string;
  coverImage: unknown;
  variant: CourseCoverVariant;
}): string | null => {
  const parsed = parseCourseCoverImage(coverImage);
  const image = parsed?.variants[variant] ?? parsed?.variants.card;

  if (!image) {
    return null;
  }

  return `/api/courses/${courseId}/cover/${variant}?v=${encodeURIComponent(
    image.key
  )}`;
};

export const getCourseCoverPublicStorageKeys = (value: unknown): string[] => {
  const coverImage = parseCourseCoverImage(value);

  if (!coverImage) {
    return [];
  }

  return Array.from(
    new Set(
      Object.values(coverImage.variants)
        .map((variant) => variant?.key)
        .filter((key): key is string => Boolean(key))
    )
  );
};

export const getCourseCoverStorageKeys = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return [];
  }

  const keys: string[] = [];

  if (isRecord(value.original) && typeof value.original.key === "string") {
    keys.push(value.original.key);
  }

  if (isRecord(value.variants)) {
    for (const variant of Object.values(value.variants)) {
      if (isRecord(variant) && typeof variant.key === "string") {
        keys.push(variant.key);
      }
    }
  }

  return Array.from(new Set(keys.filter(Boolean)));
};
