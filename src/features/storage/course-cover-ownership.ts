import type { CourseCoverImage } from "./course-cover";

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;
const SAFE_IMAGE = /^[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp)$/i;

export const isCourseCoverKeyForCourse = (
  courseId: string,
  key: string
): boolean => {
  if (!SAFE_SEGMENT.test(courseId)) {
    return false;
  }
  const prefix = `courses/${courseId}/cover/`;
  const fileName = key.slice(prefix.length);
  return (
    key.startsWith(prefix) &&
    !fileName.includes("..") &&
    SAFE_IMAGE.test(fileName)
  );
};

export const assertCourseCoverOwnership = (
  courseId: string,
  cover: CourseCoverImage | null
): void => {
  if (!cover) {
    return;
  }
  const images = [
    ...Object.values(cover.variants),
    ...(cover.original ? [cover.original] : []),
  ];
  if (
    images.some(
      (image) => image && !isCourseCoverKeyForCourse(courseId, image.key)
    )
  ) {
    throw new Error("A capa nao pertence a este Curso.");
  }
};

export const preserveCourseCover = ({
  courseId,
  current,
  submitted,
}: {
  courseId: string;
  current: CourseCoverImage | null;
  submitted: CourseCoverImage | null;
}): CourseCoverImage | null => {
  if (!submitted) {
    return null;
  }
  assertCourseCoverOwnership(courseId, submitted);
  if (JSON.stringify(submitted) !== JSON.stringify(current)) {
    throw new Error("Envie uma nova imagem pelo upload para trocar a capa.");
  }
  return current;
};
