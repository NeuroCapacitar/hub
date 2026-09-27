import "server-only";
import { getPool } from "@/db";
import {
  BANNER_STORAGE_PREFIX,
  isBannerStorageKey,
} from "@/features/storage/banner-image";
import { reconcileUnreferencedR2Objects } from "@/features/storage/orphan-reconciliation";
import { deletePublicR2Objects, deleteR2Objects } from "@/features/storage/r2";

export const reconcileDashboardBannerStorage = async ({
  now,
  shouldContinue,
}: {
  now?: Date;
  shouldContinue?: () => Promise<boolean>;
} = {}): Promise<number> => {
  const { rows } = await getPool().query<{ image_url: string }>(
    "select image_url from dashboard_banners"
  );
  const referencedKeys = new Set<string>();

  for (const row of rows) {
    if (!isBannerStorageKey(row.image_url)) {
      return 0;
    }
    referencedKeys.add(row.image_url);
  }

  return await reconcileUnreferencedR2Objects({
    isEligibleKey: isBannerStorageKey,
    ...(now ? { now } : {}),
    prefix: BANNER_STORAGE_PREFIX,
    referencedKeys,
    removeObject: async (key) => {
      await Promise.all([deletePublicR2Objects([key]), deleteR2Objects([key])]);
    },
    ...(shouldContinue ? { shouldContinue } : {}),
  });
};
