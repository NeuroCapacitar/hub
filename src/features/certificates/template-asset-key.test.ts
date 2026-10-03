import { describe, expect, it } from "vitest";
import { isCertificateTemplateAssetKey } from "./template-asset-key";

const imageId = "11111111-1111-4111-8111-111111111111";

describe("certificate template image reference ownership", () => {
  it.each([
    "webp",
    "png",
    "jpg",
  ])("preserves generated current and legacy %s images", (extension) => {
    expect(
      isCertificateTemplateAssetKey({
        courseId: "course-1",
        key: `certificates/templates/course-1/${imageId}.${extension}`,
        kind: "background",
      })
    ).toBe(true);
    expect(
      isCertificateTemplateAssetKey({
        courseId: "course-1",
        key: `certificates/templates/course-1/signatures/${imageId}.${extension}`,
        kind: "signature",
      })
    ).toBe(true);
  });

  it.each([
    `certificates/templates/course-10/${imageId}.webp`,
    `certificates/templates/course-1/${imageId}.webp/other.webp`,
    `certificates/templates/course-1/${imageId}.webp\n`,
    "certificates/templates/course-1/arbitrary.webp",
    `certificates/templates/course-1/${imageId}.pdf`,
  ])("rejects a non-generated background reference: %s", (key) => {
    expect(
      isCertificateTemplateAssetKey({
        courseId: "course-1",
        key,
        kind: "background",
      })
    ).toBe(false);
  });
});
