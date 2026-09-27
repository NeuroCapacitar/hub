import "server-only";
import { getPool } from "@/db";
import {
  COURSE_COVER_STORAGE_PREFIX,
  getCourseCoverStorageKeys,
  isCourseCoverStorageKey,
  parseCourseCoverImage,
} from "@/features/storage/course-cover";
import { reconcileUnreferencedR2Objects } from "@/features/storage/orphan-reconciliation";
import { deletePublicR2Objects, deleteR2Objects } from "@/features/storage/r2";

export const reconcileCourseCoverStorage = async ({
  now,
  shouldContinue,
}: {
  now?: Date;
  shouldContinue?: () => Promise<boolean>;
} = {}): Promise<number> => {
  const { rows } = await getPool().query<{ cover_image_json: unknown }>(
    "select cover_image_json from courses where cover_image_json is not null"
  );
  const referencedKeys = new Set<string>();

  for (const row of rows) {
    if (!parseCourseCoverImage(row.cover_image_json)) {
      return 0;
    }

    for (const key of getCourseCoverStorageKeys(row.cover_image_json)) {
      if (!isCourseCoverStorageKey(key)) {
        return 0;
      }
      referencedKeys.add(key);
    }
  }

  return await reconcileUnreferencedR2Objects({
    isEligibleKey: isCourseCoverStorageKey,
    ...(now ? { now } : {}),
    prefix: COURSE_COVER_STORAGE_PREFIX,
    referencedKeys,
    removeObject: async (key) => {
      await Promise.all([deletePublicR2Objects([key]), deleteR2Objects([key])]);
    },
    ...(shouldContinue ? { shouldContinue } : {}),
  });
};
