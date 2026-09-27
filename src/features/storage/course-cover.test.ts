import { describe, expect, it } from "vitest";
import {
  buildCourseCoverObjectKey,
  COURSE_COVER_ALLOWED_CONTENT_TYPES,
  COURSE_COVER_ASPECT_RATIO,
  COURSE_COVER_CARD_HEIGHT,
  COURSE_COVER_CARD_WIDTH,
  getCourseCoverPublicStorageKeys,
  getCourseCoverStorageKeys,
  getCourseCoverVariantPath,
  isCourseCoverUploadContentType,
  MAX_COURSE_COVER_UPLOAD_BYTES,
  parseCourseCoverImage,
  validateCourseCoverUploadRequest,
} from "./course-cover";

describe("course cover storage", () => {
  it("shares the supported upload formats and byte limit with the client field", () => {
    expect(COURSE_COVER_ALLOWED_CONTENT_TYPES).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(isCourseCoverUploadContentType("image/webp")).toBe(true);
    expect(isCourseCoverUploadContentType("image/svg+xml")).toBe(false);
    expect(MAX_COURSE_COVER_UPLOAD_BYTES).toBe(4 * 1024 * 1024);
  });

  it("defines the single course cover image as 1280x720 at 16:9", () => {
    expect(COURSE_COVER_CARD_WIDTH).toBe(1280);
    expect(COURSE_COVER_CARD_HEIGHT).toBe(720);
    expect(COURSE_COVER_ASPECT_RATIO).toBe(16 / 9);
  });

  it("builds scoped R2 object keys for cover variants", () => {
    expect(
      buildCourseCoverObjectKey({
        courseId: "course-1",
        extension: "webp",
        nonce: "upload-1",
        variant: "card",
      })
    ).toBe("courses/course-1/cover/upload-1-card.webp");
  });

  it("validates one generated image without imposing an output-size ceiling", () => {
    expect(() =>
      validateCourseCoverUploadRequest({
        courseId: "course-1",
        upload: {
          contentType: "image/png",
          fileName: "capa.png",
          sizeBytes: 4 * 1024 * 1024,
        },
        variants: [
          {
            contentType: "image/webp",
            sizeBytes: 2 * 1024 * 1024,
            variant: "card",
          },
        ],
      })
    ).not.toThrow();
  });

  it("rejects unsafe uploads, oversized inputs and a missing card image", () => {
    expect(() =>
      validateCourseCoverUploadRequest({
        courseId: "course-1",
        upload: {
          contentType: "image/svg+xml",
          fileName: "capa.png",
          sizeBytes: 1024,
        },
        variants: [],
      })
    ).toThrow("Tipo de imagem nao permitido.");

    expect(() =>
      validateCourseCoverUploadRequest({
        courseId: "course-1",
        upload: {
          contentType: "image/png",
          fileName: "capa.svg",
          sizeBytes: 1024,
        },
        variants: [],
      })
    ).toThrow("Extensao de imagem nao permitida.");

    expect(() =>
      validateCourseCoverUploadRequest({
        courseId: "course-1",
        upload: {
          contentType: "image/jpeg",
          fileName: "capa.jpg",
          sizeBytes: 4 * 1024 * 1024 + 1,
        },
        variants: [],
      })
    ).toThrow("Imagem maior que 4 MiB.");

    expect(() =>
      validateCourseCoverUploadRequest({
        courseId: "course-1",
        upload: {
          contentType: "image/png",
          fileName: "capa.png",
          sizeBytes: 1024,
        },
        variants: [],
      })
    ).toThrow("Envie a imagem final da capa.");
  });

  it("parses stored cover metadata and ignores invalid variants", () => {
    expect(
      parseCourseCoverImage({
        original: {
          contentType: "image/png",
          fileName: "capa.png",
          key: "courses/course-1/cover/upload-original.png",
          sizeBytes: 1_000_000,
        },
        variants: {
          card: {
            contentType: "image/webp",
            height: 1000,
            key: "courses/course-1/cover/upload-card.webp",
            sizeBytes: 500_000,
            width: 960,
          },
          thumb: {
            contentType: "image/webp",
            height: 500,
            key: "courses/course-1/cover/upload-thumb.webp",
            sizeBytes: 120_000,
            width: 480,
          },
        },
      })
    ).toEqual({
      blurDataUrl: undefined,
      original: {
        contentType: "image/png",
        fileName: "capa.png",
        key: "courses/course-1/cover/upload-original.png",
        sizeBytes: 1_000_000,
      },
      variants: {
        card: {
          contentType: "image/webp",
          height: 1000,
          key: "courses/course-1/cover/upload-card.webp",
          sizeBytes: 500_000,
          width: 960,
        },
        thumb: {
          contentType: "image/webp",
          height: 500,
          key: "courses/course-1/cover/upload-thumb.webp",
          sizeBytes: 120_000,
          width: 480,
        },
      },
    });
  });

  it("builds public course cover paths only for stored variants", () => {
    const firstPath = getCourseCoverVariantPath({
      courseId: "course-1",
      coverImage: {
        original: {
          contentType: "image/png",
          fileName: "capa.png",
          key: "courses/course-1/cover/upload-original.png",
          sizeBytes: 1_000_000,
        },
        variants: {
          card: {
            contentType: "image/webp",
            height: 1000,
            key: "courses/course-1/cover/upload-card.webp",
            sizeBytes: 500_000,
            width: 960,
          },
        },
      },
      variant: "card",
    });
    const updatedPath = getCourseCoverVariantPath({
      courseId: "course-1",
      coverImage: {
        original: {
          contentType: "image/png",
          fileName: "capa.png",
          key: "courses/course-1/cover/upload-original-2.png",
          sizeBytes: 1_000_000,
        },
        variants: {
          card: {
            contentType: "image/webp",
            height: 1000,
            key: "courses/course-1/cover/upload-card-2.webp",
            sizeBytes: 500_000,
            width: 960,
          },
        },
      },
      variant: "card",
    });

    expect(firstPath).toBe(
      "/api/courses/course-1/cover/card?v=courses%2Fcourse-1%2Fcover%2Fupload-card.webp"
    );
    expect(updatedPath).toBe(
      "/api/courses/course-1/cover/card?v=courses%2Fcourse-1%2Fcover%2Fupload-card-2.webp"
    );
    expect(updatedPath).not.toBe(firstPath);

    expect(
      getCourseCoverVariantPath({
        courseId: "course-1",
        coverImage: null,
        variant: "card",
      })
    ).toBeNull();
  });

  it("extracts all R2 keys from stored cover metadata, including old variants", () => {
    expect(
      getCourseCoverStorageKeys({
        original: {
          contentType: "image/png",
          fileName: "capa.png",
          key: "courses/course-1/cover/upload-original.png",
          sizeBytes: 1_000_000,
        },
        variants: {
          card: {
            contentType: "image/webp",
            height: 1000,
            key: "courses/course-1/cover/upload-card.webp",
            sizeBytes: 500_000,
            width: 960,
          },
          hero: {
            contentType: "image/webp",
            height: 900,
            key: "courses/course-1/cover/upload-hero.webp",
            sizeBytes: 900_000,
            width: 1600,
          },
          thumb: {
            contentType: "image/webp",
            height: 500,
            key: "courses/course-1/cover/upload-thumb.webp",
            sizeBytes: 120_000,
            width: 480,
          },
        },
      })
    ).toEqual([
      "courses/course-1/cover/upload-original.png",
      "courses/course-1/cover/upload-card.webp",
      "courses/course-1/cover/upload-hero.webp",
      "courses/course-1/cover/upload-thumb.webp",
    ]);
  });

  it("parses a new single-image cover without a persisted original", () => {
    const coverImage = {
      blurDataUrl: "data:image/webp;base64,blur",
      variants: {
        card: {
          contentType: "image/webp",
          height: 720,
          key: "courses/course-1/cover/upload-card.webp",
          sizeBytes: 1_500_000,
          width: 1280,
        },
      },
    };

    expect(parseCourseCoverImage(coverImage)).toEqual(coverImage);
    expect(getCourseCoverStorageKeys(coverImage)).toEqual([
      "courses/course-1/cover/upload-card.webp",
    ]);
    expect(getCourseCoverPublicStorageKeys(coverImage)).toEqual([
      "courses/course-1/cover/upload-card.webp",
    ]);
  });

  it("does not publish the legacy original object", () => {
    const legacyCover = {
      original: {
        contentType: "image/png",
        fileName: "capa.png",
        key: "courses/course-1/cover/upload-original.png",
        sizeBytes: 1_000_000,
      },
      variants: {
        card: {
          contentType: "image/webp",
          height: 1000,
          key: "courses/course-1/cover/upload-card.webp",
          sizeBytes: 500_000,
          width: 960,
        },
        thumb: {
          contentType: "image/webp",
          height: 500,
          key: "courses/course-1/cover/upload-thumb.webp",
          sizeBytes: 120_000,
          width: 480,
        },
      },
    };

    expect(getCourseCoverPublicStorageKeys(legacyCover)).toEqual([
      "courses/course-1/cover/upload-card.webp",
      "courses/course-1/cover/upload-thumb.webp",
    ]);
    expect(getCourseCoverStorageKeys(legacyCover)).toContain(
      "courses/course-1/cover/upload-original.png"
    );
  });
});
