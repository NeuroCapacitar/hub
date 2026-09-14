import "server-only";
import { getPool } from "@/db";
import {
  AUTH_MEDIA_PUBLIC_PREFIX,
  isAuthMediaObjectKey,
} from "@/features/auth-media/contract";
import {
  deletePublicR2Objects,
  deleteR2Objects,
  listPrivateR2Objects,
  listPublicR2Objects,
  publishR2Object,
  type R2ObjectSummary,
} from "@/features/storage/r2";

const AUTH_MEDIA_STORAGE_MAX_ATTEMPTS = 3;
const AUTH_MEDIA_STORAGE_RETRY_DELAYS_MS = [100, 250] as const;
const AUTH_MEDIA_CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;
const AUTH_MEDIA_CLEANUP_LIMIT = 100;

type Wait = (durationMs: number) => Promise<void>;

const sleep: Wait = async (durationMs) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
};

export const runWithAuthMediaStorageRetry = async <Result>({
  maxAttempts = AUTH_MEDIA_STORAGE_MAX_ATTEMPTS,
  operation,
  wait = sleep,
}: {
  maxAttempts?: number;
  operation: () => Promise<Result>;
  wait?: Wait;
}): Promise<Result> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      if (attempt === maxAttempts - 1) {
        break;
      }
      await wait(AUTH_MEDIA_STORAGE_RETRY_DELAYS_MS[attempt] ?? 250);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("A operação de mídia da tela de acesso falhou.");
};

export const synchronizeAuthMediaPublicObject = async ({
  isActive,
  key,
}: {
  isActive: boolean;
  key: string;
}): Promise<void> => {
  await runWithAuthMediaStorageRetry({
    operation: () =>
      isActive ? publishR2Object(key) : deletePublicR2Objects([key]),
  });
};

export const removeAuthMediaObject = async (key: string): Promise<void> => {
  await runWithAuthMediaStorageRetry({
    operation: async () => {
      await Promise.all([deleteR2Objects([key]), deletePublicR2Objects([key])]);
    },
  });
};

export const reconcileAuthMediaStorage = async ({
  now = new Date(),
  shouldContinue = async () => true,
}: {
  now?: Date;
  shouldContinue?: () => Promise<boolean>;
} = {}): Promise<number> => {
  const pool = getPool();
  const activeRows = await pool.query<{
    image_url: string;
    is_active: boolean;
  }>(
    "select image_url, is_active from auth_media_slides order by sort_order, id"
  );

  let reconciled = 0;
  for (const row of activeRows.rows) {
    if (!(await shouldContinue())) {
      break;
    }
    if (!isAuthMediaObjectKey(row.image_url)) {
      continue;
    }

    try {
      await synchronizeAuthMediaPublicObject({
        isActive: row.is_active,
        key: row.image_url,
      });
      reconciled += 1;
    } catch {
      // The next maintenance run retries unavailable R2 operations.
    }
  }

  if (!(await shouldContinue())) {
    return reconciled;
  }

  let privateObjects: R2ObjectSummary[] = [];
  let publicObjects: R2ObjectSummary[] = [];
  try {
    [privateObjects, publicObjects] = await Promise.all([
      listPrivateR2Objects(AUTH_MEDIA_PUBLIC_PREFIX),
      listPublicR2Objects(AUTH_MEDIA_PUBLIC_PREFIX),
    ]);
  } catch {
    return reconciled;
  }

  const referencedKeys = new Set(
    activeRows.rows
      .map((row) => row.image_url)
      .filter((key) => isAuthMediaObjectKey(key))
  );
  const latestObjectTimes = new Map<string, number>();
  for (const object of [...privateObjects, ...publicObjects]) {
    if (!isAuthMediaObjectKey(object.key) || referencedKeys.has(object.key)) {
      continue;
    }

    latestObjectTimes.set(
      object.key,
      Math.max(
        latestObjectTimes.get(object.key) ?? Number.NEGATIVE_INFINITY,
        object.lastModified.getTime()
      )
    );
  }

  const olderThan = now.getTime() - AUTH_MEDIA_CLEANUP_GRACE_MS;
  const staleKeys = [...latestObjectTimes.entries()]
    .filter(([, lastModified]) => lastModified < olderThan)
    .map(([key]) => key)
    .slice(0, AUTH_MEDIA_CLEANUP_LIMIT);

  for (const key of staleKeys) {
    if (!(await shouldContinue())) {
      break;
    }
    try {
      await removeAuthMediaObject(key);
      reconciled += 1;
    } catch {
      // Keep the key for the next maintenance retry.
    }
  }

  return reconciled;
};
