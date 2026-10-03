import type { LessonResourceUploadReference } from "./lesson-resource-upload";
import { sanitizeR2FileName } from "./r2-objects";

const PUBLISHED_LESSON_RESOURCE_KEY_PATTERN =
  /^lessons\/[A-Za-z0-9_-]+\/resources\/published\/[0-9a-f-]+-[a-z0-9.-]+$/i;

export const isPublishedLessonResourceKey = (key: string): boolean =>
  PUBLISHED_LESSON_RESOURCE_KEY_PATTERN.test(key);

export const buildPublishedLessonResource = ({
  lessonId,
  nonce,
  resource,
}: {
  lessonId: string;
  nonce: string;
  resource: LessonResourceUploadReference;
}): LessonResourceUploadReference => ({
  ...resource,
  key: `lessons/${lessonId}/resources/published/${nonce}-attachment-${sanitizeR2FileName(resource.fileName)}`,
  ...(resource.preview
    ? {
        preview: {
          ...resource.preview,
          key: `lessons/${lessonId}/resources/published/${nonce}-preview.webp`,
        },
      }
    : {}),
});
