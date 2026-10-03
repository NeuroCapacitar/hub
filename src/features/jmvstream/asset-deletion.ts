import "server-only";
import { getPool } from "@/db";
import { lockCourseContentRelease } from "@/features/courses/content-release-lock";
import { getConfiguredJmvstreamClient } from "@/features/jmvstream/auth";
import { isJmvstreamVideoNotFoundError } from "@/features/jmvstream/provider-mapper";
import {
  isJmvstreamAssetProtected,
  lockJmvstreamVideoLifecycle,
} from "./asset-lifecycle";

export interface JmvstreamDeleteResult {
  attempted: number;
  failed: number;
}

export const deleteJmvstreamAssetsForCourse = (
  courseId: string
): Promise<JmvstreamDeleteResult> =>
  deleteAssetsByQuery("course_id = $1", [courseId]);

export const deleteJmvstreamAssetsForLesson = async (
  lessonId: string
): Promise<JmvstreamDeleteResult> => {
  const { rows } = await getPool().query<{
    video_external_id: string | null;
  }>("select video_external_id from lessons where id = $1 limit 1", [lessonId]);
  const videoHash = rows[0]?.video_external_id;

  if (videoHash) {
    return deleteAssetsByQuery("(lesson_id = $1 or video_hash = $2)", [
      lessonId,
      videoHash,
    ]);
  }

  return deleteAssetsByQuery("lesson_id = $1", [lessonId]);
};

export const deleteJmvstreamAssetsForModule = (
  moduleId: string
): Promise<JmvstreamDeleteResult> =>
  deleteAssetsByQuery("module_id = $1", [moduleId]);

export const retryJmvstreamAssetDelete = async (
  assetId: string
): Promise<void> => {
  const { rows } = await getPool().query<{ id: string }>(
    "select id from jmvstream_video_assets where id = $1 and delete_status in ('failed', 'pending') limit 1",
    [assetId]
  );

  if (!rows[0]) {
    throw new Error("Asset JMVStream invalido.");
  }

  const deleted = await deleteAssetById(assetId, true);

  if (!deleted) {
    throw new Error("Nao foi possivel apagar o video na JMVStream.");
  }
};

export const deleteActiveAssetsForLesson = async (
  lessonId: string,
  exceptVideoHash?: string
): Promise<void> => {
  const params: unknown[] = [lessonId];
  const exceptCondition = exceptVideoHash ? "and video_hash <> $2" : "";

  if (exceptVideoHash) {
    params.push(exceptVideoHash);
  }

  await deleteAssetsByQuery(
    `lesson_id = $1 and delete_status <> 'deleted' ${exceptCondition}`,
    params
  );
};

const deleteAssetsByQuery = async (
  whereClause: string,
  values: unknown[]
): Promise<JmvstreamDeleteResult> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select id
      from jmvstream_video_assets
      where ${whereClause}
    `,
    values
  );
  const result: JmvstreamDeleteResult = { attempted: rows.length, failed: 0 };

  for (const row of rows) {
    const deleted = await deleteAssetById(row.id);

    if (!deleted) {
      result.failed += 1;
    }
  }

  return result;
};

const claimJmvstreamAssetDeletion = async (
  assetId: string,
  retryOnly: boolean
): Promise<{ video_hash: string } | null> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await lockJmvstreamVideoLifecycle(client);
    const context = await client.query<{ course_id: string | null }>(
      "select course_id from jmvstream_video_assets where id = $1",
      [assetId]
    );
    const courseId = context.rows[0]?.course_id;
    if (courseId) {
      await lockCourseContentRelease(client, courseId);
    }
    const candidate = await client.query<{
      video_hash: string;
      player_url: string | null;
    }>(
      "select video_hash, player_url from jmvstream_video_assets where id = $1",
      [assetId]
    );
    const asset = candidate.rows[0];
    if (
      !asset ||
      (await isJmvstreamAssetProtected(
        client,
        asset.video_hash,
        asset.player_url
      ))
    ) {
      await client.query("commit");
      return null;
    }
    const claimed = await client.query<{ video_hash: string }>(
      `update jmvstream_video_assets a
       set delete_status = 'pending', delete_attempts = delete_attempts + 1,
           updated_at = now()
       where a.id = $1 and a.delete_status <> 'deleted'
         and (not $2::boolean or a.delete_status in ('failed', 'pending'))
         and not exists (
           select 1 from lessons l
           join course_publications cp on cp.id = l.course_publication_id
           where l.video_provider = 'jmvstream' and l.video_external_id = a.video_hash
             and cp.status in ('published', 'retired')
         )
       returning a.video_hash`,
      [assetId, retryOnly]
    );
    await client.query("commit");
    return claimed.rows[0] ?? null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const deleteReplacedJmvstreamAssets = async (
  assetIds: readonly string[]
): Promise<JmvstreamDeleteResult> => {
  const result: JmvstreamDeleteResult = { attempted: 0, failed: 0 };
  for (const assetId of assetIds) {
    result.attempted += 1;
    try {
      if (!(await deleteAssetById(assetId, true))) {
        result.failed += 1;
      }
    } catch {
      result.failed += 1;
    }
  }
  return result;
};

const deleteAssetById = async (
  assetId: string,
  retryOnly = false
): Promise<boolean> => {
  const asset = await claimJmvstreamAssetDeletion(assetId, retryOnly);
  if (!asset) {
    if (retryOnly) {
      throw new Error(
        "O video nao possui exclusao pendente ou esta protegido por uma publicacao."
      );
    }
    return true;
  }

  const client = await getConfiguredJmvstreamClient();

  try {
    await client.deleteVideo(asset.video_hash);
    await markJmvstreamAssetDeleted(assetId);
    return true;
  } catch (error) {
    const deleteError =
      error instanceof Error
        ? error
        : new Error("Nao foi possivel apagar o video na JMVStream.");

    try {
      await client.getVideo(asset.video_hash);
    } catch (verificationError) {
      if (isJmvstreamVideoNotFoundError(verificationError)) {
        await markJmvstreamAssetDeleted(assetId);
        return true;
      }
    }

    await getPool().query(
      `
        update jmvstream_video_assets
        set delete_status = 'failed',
            last_error = $2,
            updated_at = now()
        where id = $1
      `,
      [assetId, deleteError.message]
    );
    return false;
  }
};

const markJmvstreamAssetDeleted = async (assetId: string): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set delete_status = 'deleted',
          lesson_id = null,
          last_error = null,
          updated_at = now()
      where id = $1
    `,
    [assetId]
  );
};
