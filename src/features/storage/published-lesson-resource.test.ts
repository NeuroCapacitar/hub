import { describe, expect, it } from "vitest";
import { buildPublishedLessonResource } from "./published-lesson-resource";

describe("published attachment and preview identities", () => {
  it("keeps an attachment named preview.webp separate from its thumbnail", () => {
    const published = buildPublishedLessonResource({
      lessonId: "lesson-1",
      nonce: "12345678-1234-4234-8234-123456789abc",
      resource: {
        contentType: "image/webp",
        fileName: "preview.webp",
        id: "resource-1",
        key: "lessons/lesson-1/resources/source.webp",
        label: "Imagem",
        preview: {
          contentType: "image/webp",
          height: 180,
          key: "lessons/lesson-1/resources/source-preview.webp",
          sizeBytes: 10,
          width: 320,
        },
        sizeBytes: 50,
        storage: "r2",
      },
    });
    expect(published.key).not.toBe(published.preview?.key);
    expect(published.key).toContain("-attachment-preview.webp");
  });
});
