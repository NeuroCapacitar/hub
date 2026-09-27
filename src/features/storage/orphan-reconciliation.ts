import "server-only";
import {
  listPrivateR2Objects,
  listPublicR2Objects,
  type R2ObjectSummary,
} from "@/features/storage/r2";

const ORPHANED_R2_OBJECT_GRACE_MS = 24 * 60 * 60 * 1000;
const ORPHANED_R2_OBJECTS_PER_RUN = 100;

export interface ReconcileUnreferencedR2ObjectsInput {
  isEligibleKey: (key: string) => boolean;
  now?: Date;
  prefix: string;
  referencedKeys: ReadonlySet<string>;
  removeObject: (key: string) => Promise<void>;
  shouldContinue?: () => Promise<boolean>;
}

export const reconcileUnreferencedR2Objects = async ({
  isEligibleKey,
  now = new Date(),
  prefix,
  referencedKeys,
  removeObject,
  shouldContinue = async () => true,
}: ReconcileUnreferencedR2ObjectsInput): Promise<number> => {
  if (!(await shouldContinue())) {
    return 0;
  }

  let privateObjects: R2ObjectSummary[];
  let publicObjects: R2ObjectSummary[];
  try {
    [privateObjects, publicObjects] = await Promise.all([
      listPrivateR2Objects(prefix),
      listPublicR2Objects(prefix),
    ]);
  } catch {
    return 0;
  }

  const latestObjectTimes = new Map<string, number>();
  for (const object of [...privateObjects, ...publicObjects]) {
    if (!isEligibleKey(object.key) || referencedKeys.has(object.key)) {
      continue;
    }

    const modifiedAt = object.lastModified.getTime();
    if (!Number.isFinite(modifiedAt)) {
      continue;
    }

    latestObjectTimes.set(
      object.key,
      Math.max(
        latestObjectTimes.get(object.key) ?? Number.NEGATIVE_INFINITY,
        modifiedAt
      )
    );
  }

  const olderThan = now.getTime() - ORPHANED_R2_OBJECT_GRACE_MS;
  const staleKeys = [...latestObjectTimes.entries()]
    .filter(([, lastModified]) => lastModified < olderThan)
    .map(([key]) => key)
    .slice(0, ORPHANED_R2_OBJECTS_PER_RUN);

  let removed = 0;
  for (const key of staleKeys) {
    if (!(await shouldContinue())) {
      break;
    }

    try {
      await removeObject(key);
      removed += 1;
    } catch {
      // Keep the orphan listed so the next maintenance run can retry it.
    }
  }

  return removed;
};
