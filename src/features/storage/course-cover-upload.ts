import sharp from "sharp";
import {
  buildCourseCoverObjectKey,
  COURSE_COVER_VARIANTS,
  type CourseCoverImage,
  type CourseCoverOutputVariant,
  validateCourseCoverUploadRequest,
} from "@/features/storage/course-cover";

const VARIANT_QUALITY: Record<CourseCoverOutputVariant, number> = {
  card: 82,
};

export interface CourseCoverFile {
  contentType: string;
  file: File;
  fileName: string;
  sizeBytes: number;
}

export interface CourseCoverUploadObject {
  body: Buffer;
  contentType: string;
  key: string;
}

export const readCourseCoverFile = (value: unknown): CourseCoverFile | null => {
  if (!(value instanceof File)) {
    return null;
  }

  const fileName = typeof value.name === "string" ? value.name : "";
  const isEmptyFormFile =
    value.size === 0 &&
    (!fileName.trim() || value.type === "application/octet-stream");

  if (isEmptyFormFile) {
    return null;
  }

  const coverFile = {
    contentType: value.type,
    file: value,
    fileName,
    sizeBytes: value.size,
  };

  validateCourseCoverUploadRequest({
    courseId: "pending-course",
    upload: coverFile,
    variants: [
      {
        contentType: "image/webp",
        sizeBytes: 1,
        variant: "card",
      },
    ],
  });

  return coverFile;
};

export const createCourseCoverUploadParts = async ({
  courseId,
  file,
  nonce,
}: {
  courseId: string;
  file: CourseCoverFile | null;
  nonce: string;
}): Promise<{
  coverImage: CourseCoverImage;
  objects: CourseCoverUploadObject[];
}> => {
  if (!file) {
    throw new Error("Capa invalida.");
  }

  const uploadedBuffer = Buffer.from(await file.file.arrayBuffer());
  const blurDataUrl = `data:image/webp;base64,${(
    await sharp(uploadedBuffer)
      .rotate()
      .resize({ width: 10 })
      .webp({ quality: 20 })
      .toBuffer()
  ).toString("base64")}`;
  const coverImage: CourseCoverImage = {
    blurDataUrl,
    variants: {},
  };
  const objects: CourseCoverUploadObject[] = [];

  for (const variant of Object.keys(
    COURSE_COVER_VARIANTS
  ) as CourseCoverOutputVariant[]) {
    const dimensions = COURSE_COVER_VARIANTS[variant];
    const body = await sharp(uploadedBuffer)
      .rotate()
      .resize(dimensions.width, dimensions.height, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: VARIANT_QUALITY[variant] })
      .toBuffer();
    const key = buildCourseCoverObjectKey({
      courseId,
      extension: "webp",
      nonce,
      variant,
    });

    coverImage.variants[variant] = {
      contentType: "image/webp",
      height: dimensions.height,
      key,
      sizeBytes: body.length,
      width: dimensions.width,
    };
    objects.push({
      body,
      contentType: "image/webp",
      key,
    });
  }

  const variants = (
    Object.keys(COURSE_COVER_VARIANTS) as CourseCoverOutputVariant[]
  ).map((variant) => {
    const image = coverImage.variants[variant];

    if (!image) {
      throw new Error("Variante da capa indisponivel.");
    }

    return {
      contentType: image.contentType,
      sizeBytes: image.sizeBytes,
      variant,
    };
  });

  validateCourseCoverUploadRequest({
    courseId,
    upload: {
      contentType: file.contentType,
      fileName: file.fileName,
      sizeBytes: file.sizeBytes,
    },
    variants,
  });

  return { coverImage, objects };
};
