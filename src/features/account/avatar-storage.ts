import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { processUserAvatarImage } from "@/features/account/avatar-image";
import {
  deletePrivateUserAvatarObject,
  listPrivateR2Objects,
  readPrivateUserAvatarObject,
  uploadPrivateUserAvatarObject,
} from "@/features/storage/r2";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability";

const USER_AVATAR_PREFIX = "user-avatars";
const USER_AVATAR_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const USER_AVATAR_ORPHANS_PER_RUN = 100;
const SAFE_USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const USER_AVATAR_KEY_PATTERN =
  /^user-avatars\/[A-Za-z0-9_-]{1,200}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

const logAvatarStorageFailure = (errorCode: string): void => {
  logOperationalEvent({
    correlationId: createCorrelationId(null),
    errorCode,
    operation: "account.avatar.storage",
    outcome: "failure",
    provider: "r2",
  });
};

interface PreviousAvatarRow {
  avatar_key: string | null;
}

const withTransaction = async <Result>(
  operation: (client: PoolClient) => Promise<Result>
): Promise<Result> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
};

const assertUserAvatarKey = (userId: string, key: string): void => {
  if (
    !(
      SAFE_USER_ID_PATTERN.test(userId) &&
      USER_AVATAR_KEY_PATTERN.test(key) &&
      key.startsWith(`${USER_AVATAR_PREFIX}/${userId}/`)
    )
  ) {
    throw new Error("Avatar privado inválido.");
  }
};

const getPreviousAvatar = async (
  client: Pick<PoolClient, "query">,
  userId: string
): Promise<PreviousAvatarRow> => {
  const result = await client.query<PreviousAvatarRow>(
    [
      "select profiles.avatar_key",
      "from profiles",
      "where profiles.user_id = $1",
      "limit 1",
      "for update",
    ].join("\n"),
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Não foi possível localizar o perfil.");
  }
  return row;
};

const removeOldAvatar = async (
  userId: string,
  key: string | null
): Promise<void> => {
  if (!key) {
    return;
  }
  try {
    await deletePrivateUserAvatarObject({ key, userId });
  } catch {
    logAvatarStorageFailure("avatar_old_object_cleanup_deferred");
  }
};

export const saveUserAvatar = async ({
  file,
  userId,
}: {
  file: File;
  userId: string;
}): Promise<void> => {
  if (!SAFE_USER_ID_PATTERN.test(userId)) {
    throw new Error("Conta inválida.");
  }
  const processed = await processUserAvatarImage(file);
  const objectKey = `${USER_AVATAR_PREFIX}/${userId}/${randomUUID()}.webp`;
  assertUserAvatarKey(userId, objectKey);
  await uploadPrivateUserAvatarObject({
    body: processed.body,
    key: objectKey,
    userId,
  });

  let previousAvatar: string | null = null;
  try {
    previousAvatar = await withTransaction(async (client) => {
      const previous = await getPreviousAvatar(client, userId);
      await client.query(
        [
          "update profiles",
          "set avatar_mode = 'custom',",
          "    avatar_key = $2,",
          "    updated_at = now()",
          "where user_id = $1",
        ].join("\n"),
        [userId, objectKey]
      );
      return previous.avatar_key;
    });
  } catch (error) {
    try {
      await deletePrivateUserAvatarObject({ key: objectKey, userId });
    } catch {
      logAvatarStorageFailure("avatar_failed_upload_cleanup_deferred");
    }
    throw error;
  }

  await removeOldAvatar(userId, previousAvatar);
};

export const removeUserAvatar = async ({
  userId,
}: {
  userId: string;
}): Promise<void> => {
  const previousAvatar = await withTransaction(async (client) => {
    const previous = await getPreviousAvatar(client, userId);
    await client.query(
      [
        "update profiles",
        "set avatar_mode = 'initials',",
        "    avatar_key = null,",
        "    updated_at = now()",
        "where user_id = $1",
      ].join("\n"),
      [userId]
    );
    return previous.avatar_key;
  });
  await removeOldAvatar(userId, previousAvatar);
};

export const readCurrentUserAvatar = async (
  userId: string
): Promise<Buffer | null> => {
  const result = await getPool().query<{ avatar_key: string | null }>(
    [
      "select avatar_key",
      "from profiles",
      "where user_id = $1 and avatar_mode = 'custom'",
      "limit 1",
    ].join("\n"),
    [userId]
  );
  const key = result.rows[0]?.avatar_key;
  if (!key) {
    return null;
  }
  assertUserAvatarKey(userId, key);
  return await readPrivateUserAvatarObject({ key, userId });
};

export const reconcileUnusedUserAvatars = async ({
  now = new Date(),
  shouldContinue = async () => true,
}: {
  now?: Date;
  shouldContinue?: () => Promise<boolean>;
} = {}): Promise<number> => {
  const result = await getPool().query<{ avatar_key: string }>(
    [
      "select avatar_key from profiles",
      "where avatar_mode = 'custom' and avatar_key is not null",
    ].join("\n")
  );
  const referencedKeys = new Set(result.rows.map((row) => row.avatar_key));
  if (!(await shouldContinue())) {
    return 0;
  }

  let existingObjects: Awaited<ReturnType<typeof listPrivateR2Objects>>;
  try {
    existingObjects = await listPrivateR2Objects(USER_AVATAR_PREFIX);
  } catch {
    logAvatarStorageFailure("avatar_orphan_listing_failed");
    return 0;
  }

  const staleBefore = now.getTime() - USER_AVATAR_ORPHAN_GRACE_MS;
  let removed = 0;
  for (const object of existingObjects) {
    if (!(await shouldContinue())) {
      break;
    }
    if (
      referencedKeys.has(object.key) ||
      !USER_AVATAR_KEY_PATTERN.test(object.key) ||
      object.lastModified.getTime() >= staleBefore
    ) {
      continue;
    }
    const userId = object.key.split("/")[1];
    if (!userId) {
      continue;
    }
    try {
      await deletePrivateUserAvatarObject({ key: object.key, userId });
      removed += 1;
    } catch {
      logAvatarStorageFailure("avatar_orphan_delete_failed");
    }
    if (removed >= USER_AVATAR_ORPHANS_PER_RUN) {
      break;
    }
  }
  return removed;
};
