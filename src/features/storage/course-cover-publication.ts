import "server-only";
import {
  getCourseCoverPublicStorageKeys,
  getCourseCoverStorageKeys,
} from "@/features/storage/course-cover";
import { deletePublicR2Objects, publishR2Object } from "@/features/storage/r2";

/**
 * Copies the visual cover variants to the public bucket. Idempotent: it must
 * run before any state change that makes the cover route redirect to the
 * public URL, otherwise the redirect points to a missing object.
 */
export const publishCourseCover = async (
  coverImage: unknown
): Promise<void> => {
  await Promise.all(
    getCourseCoverPublicStorageKeys(coverImage).map((key) =>
      publishR2Object(key)
    )
  );
};

export const unpublishCourseCover = async (
  coverImage: unknown
): Promise<void> => {
  await deletePublicR2Objects(getCourseCoverStorageKeys(coverImage));
};
