import { describe, expect, it } from "vitest";
import {
  assertCourseCoverOwnership,
  isCourseCoverKeyForCourse,
  preserveCourseCover,
} from "./course-cover-ownership";

const cover = {
  variants: {
    card: {
      key: "courses/course-1/cover/card.webp",
      contentType: "image/webp",
      height: 720,
      width: 1280,
      sizeBytes: 10,
    },
  },
};

describe("course cover reference authority", () => {
  it("preserves only the exact existing metadata and permits removal", () => {
    expect(
      preserveCourseCover({
        courseId: "course-1",
        current: cover,
        submitted: cover,
      })
    ).toBe(cover);
    expect(
      preserveCourseCover({
        courseId: "course-1",
        current: cover,
        submitted: null,
      })
    ).toBeNull();
  });
  it("requires a server upload for a new key even inside the right namespace", () => {
    const submitted = {
      variants: {
        card: {
          ...cover.variants.card,
          key: "courses/course-1/cover/new.webp",
        },
      },
    };
    expect(() =>
      preserveCourseCover({ courseId: "course-1", current: cover, submitted })
    ).toThrow("upload");
    expect(() =>
      preserveCourseCover({
        courseId: "course-1",
        current: null,
        submitted: cover,
      })
    ).toThrow("upload");
  });
  it.each([
    "lessons/lesson-1/resources/private.pdf",
    "certificates/cert-1/certificate.pdf",
    "courses/course-2/cover/card.webp",
    "courses/course-1/cover/../card.webp",
    "courses/course-1/cover/nested/card.webp",
    "courses/course-1/cover/card.webp?redirect=other",
  ])("rejects the non-cover or foreign key %s", (key) => {
    expect(isCourseCoverKeyForCourse("course-1", key)).toBe(false);
    expect(() =>
      assertCourseCoverOwnership("course-1", {
        variants: { card: { ...cover.variants.card, key } },
      })
    ).toThrow("Curso");
  });
});
