import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import {
  isJmvstreamAssetProtected,
  lockJmvstreamVideoLifecycle,
} from "./asset-lifecycle";
import { withJmvstreamLessonDraft } from "./lesson-lifecycle";

export interface JmvstreamAsset {
  deleteStatus: string;
  filename: string;
  galleryUuid: string | null;
  id: string;
  lastError: string | null;
  lessonId: string | null;
  uploadStatus: string;
  videoHash: string;
}

interface JmvstreamAssetRow {
  delete_status: string;
  filename: string;
  gallery_uuid: string | null;
  id: string;
  last_error: string | null;
  lesson_id: string | null;
  upload_status: string;
  video_hash: string;
}

export interface JmvstreamLessonContext {
  course_id: string;
  course_title: string;
  lesson_title: string;
  module_id: string;
  module_title: string;
}

const STALE_UPLOAD_INTERVAL = "6 hours";

export const getJmvstreamAssets = (): Promise<JmvstreamAsset[]> =>
  readJmvstreamAssets();

export const getJmvstreamAssetsForLesson = (
  lessonId: string
): Promise<JmvstreamAsset[]> => readJmvstreamAssets({ lessonId });

const readJmvstreamAssets = async ({
  lessonId,
}: {
  lessonId?: string;
} = {}): Promise<JmvstreamAsset[]> => {
  const lessonScope = lessonId ? "and lesson_id = $1" : "";
  const query = `
    select id, lesson_id, video_hash, gallery_uuid, filename,
           upload_status, delete_status, last_error
    from jmvstream_video_assets
    where delete_status <> 'deleted'
    ${lessonScope}
    order by jmvstream_video_assets.updated_at desc
  `;
  const { rows } = lessonId
    ? await getPool().query<JmvstreamAssetRow>(query, [lessonId])
    : await getPool().query<JmvstreamAssetRow>(query);

  return rows.map((row) => ({
    deleteStatus: row.delete_status,
    filename: row.filename,
    galleryUuid: row.gallery_uuid,
    id: row.id,
    lastError: row.last_error,
    lessonId: row.lesson_id,
    uploadStatus: row.upload_status,
    videoHash: row.video_hash,
  }));
};

export const getJmvstreamLessonContext = async (
  lessonId: string
): Promise<JmvstreamLessonContext | null> => {
  const { rows } = await getPool().query<JmvstreamLessonContext>(
    `
      select l.title as lesson_title, m.id as module_id, m.title as module_title,
             c.id as course_id, c.title as course_title
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      join course_publications cp on cp.id = l.course_publication_id
      where l.id = $1 and cp.status = 'draft'
      limit 1
    `,
    [lessonId]
  );

  return rows[0] ?? null;
};

export const recordJmvstreamUploadSession = async ({
  fileName,
  fileSize,
  galleryUuid,
  lesson,
  lessonId,
  objectName,
  uploadId,
  videoHash,
}: {
  fileName: string;
  fileSize: number;
  galleryUuid: string;
  lesson: JmvstreamLessonContext;
  lessonId: string;
  objectName: string;
  uploadId: string;
  videoHash: string;
}): Promise<string> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      insert into jmvstream_video_assets (
        lesson_id, module_id, course_id, video_hash, gallery_uuid, filename,
        size_bytes, object_name, upload_id, upload_status, delete_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'uploading', 'none')
      on conflict (video_hash) do nothing
      returning id
    `,
    [
      lessonId,
      lesson.module_id,
      lesson.course_id,
      videoHash,
      galleryUuid,
      fileName,
      fileSize,
      objectName,
      uploadId,
    ]
  );
  const uploadSessionId = rows[0]?.id;

  if (!uploadSessionId) {
    throw new Error("Nao foi possivel registrar a sessao de upload JMVStream.");
  }

  return uploadSessionId;
};

export const assertJmvstreamVideoHashAvailable = async (
  videoHash: string,
  lessonId?: string
): Promise<void> => {
  const { rows } = await getPool().query<{ lesson_id: string | null }>(
    `
      select lesson_id
      from jmvstream_video_assets
      where video_hash = $1
        and delete_status <> 'deleted'
      limit 1
    `,
    [videoHash]
  );
  const ownerLessonId = rows[0]?.lesson_id;

  if (ownerLessonId && ownerLessonId !== lessonId) {
    throw new Error(
      "Este video_hash da JMVStream ja esta vinculado a outra aula."
    );
  }
};

export const assertJmvstreamUploadSessionMatches = async ({
  filename,
  lessonId,
  objectName,
  size,
  uploadId,
  uploadSessionId,
  videoHash,
  queryable = getPool(),
}: {
  filename: string;
  lessonId: string;
  objectName: string;
  size: number;
  uploadId: string;
  uploadSessionId: string;
  videoHash: string;
  queryable?: Pick<PoolClient, "query">;
}): Promise<void> => {
  const { rows } = await queryable.query<{ id: string }>(
    `
      select id
      from jmvstream_video_assets
      where id = $1
        and lesson_id = $2
        and video_hash = $3
        and upload_status = 'uploading'
        and delete_status = 'none'
        and filename = $4
        and object_name = $5
        and size_bytes = $6
        and upload_id = $7
      limit 1
    `,
    [uploadSessionId, lessonId, videoHash, filename, objectName, size, uploadId]
  );

  if (!rows[0]) {
    throw new Error("Sessao de upload JMVStream invalida ou expirada.");
  }
};

export const markJmvstreamUploadFailed = async ({
  lastError,
  uploadSessionId,
  videoHash,
}: {
  lastError: string;
  uploadSessionId?: string;
  videoHash: string;
}): Promise<void> => {
  await mutateUnprotectedJmvstreamAsset(videoHash, false, async (client) =>
    client.query(
      `
      update jmvstream_video_assets
      set upload_status = 'failed',
          last_error = $2,
          updated_at = now()
      where video_hash = $1
        and upload_status in ('uploading', 'processing')
        and delete_status = 'none'
        and ($3::uuid is null or (
          id = $3 and upload_status = 'uploading' and delete_status = 'none'
        ))
    `,
      [videoHash, lastError, uploadSessionId ?? null]
    )
  );
};

export const discardJmvstreamUpload = async ({
  assetId,
}: {
  assetId: string;
}): Promise<void> => {
  await mutateUnprotectedJmvstreamAsset(
    assetId,
    true,
    async (client) =>
      client.query(
        `
      update jmvstream_video_assets
      set delete_status = 'deleted',
          lesson_id = null,
          last_error = null,
          updated_at = now()
      where id = $1
        and upload_status = 'failed'
        and delete_status = 'none'
    `,
        [assetId]
      ),
    true
  );
};

const mutateUnprotectedJmvstreamAsset = async (
  identifier: string,
  byId: boolean,
  operation: (client: PoolClient) => Promise<unknown>,
  includeDrafts = false
): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await lockJmvstreamVideoLifecycle(client);
    const { rows } = await client.query<{
      video_hash: string;
      player_url: string | null;
    }>(
      `select video_hash, player_url from jmvstream_video_assets where ${byId ? "id" : "video_hash"} = $1`,
      [identifier]
    );
    const asset = rows[0];
    if (
      asset &&
      !(await isJmvstreamAssetProtected(
        client,
        asset.video_hash,
        asset.player_url,
        includeDrafts
      ))
    ) {
      await operation(client);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const recordCompletedJmvstreamUpload = async ({
  filename,
  galleryUuid,
  jobId,
  lesson,
  lessonId,
  objectName,
  playerUrl,
  size,
  thumbnailUrl,
  uploadId,
  uploadSessionId,
  uploadStatus,
  videoHash,
}: {
  filename: string;
  galleryUuid: string;
  jobId: string | null;
  lesson: JmvstreamLessonContext;
  lessonId: string;
  objectName: string;
  playerUrl: string | null;
  size: number;
  thumbnailUrl: string | null;
  uploadId: string;
  uploadSessionId: string;
  uploadStatus: "processing" | "ready";
  videoHash: string;
}): Promise<string[]> =>
  await withJmvstreamLessonDraft({
    courseId: lesson.course_id,
    lessonId,
    operation: async (client) => {
      await assertJmvstreamUploadSessionMatches({
        filename,
        lessonId,
        objectName,
        size,
        uploadId,
        uploadSessionId,
        videoHash,
        queryable: client,
      });
      const priorAssets = await client.query<{
        id: string;
        video_hash: string;
        player_url: string | null;
      }>(
        `select id, video_hash, player_url from jmvstream_video_assets
         where lesson_id = $1 and video_hash <> $2 and delete_status = 'none'
           and upload_status in ('processing', 'ready')`,
        [lessonId, videoHash]
      );
      for (const prior of priorAssets.rows) {
        if (
          await isJmvstreamAssetProtected(
            client,
            prior.video_hash,
            prior.player_url
          )
        ) {
          await client.query(
            "update jmvstream_video_assets set lesson_id = null, updated_at = now() where id = $1",
            [prior.id]
          );
        }
      }
      await client.query(
        `update jmvstream_video_assets a
         set lesson_id = null, updated_at = now()
         where a.lesson_id = $1 and a.video_hash <> $2 and a.delete_status = 'none'
           and a.upload_status in ('processing', 'ready')
           and exists (select 1 from lessons l
             join course_publications cp on cp.id = l.course_publication_id
             where l.video_provider = 'jmvstream' and l.video_external_id = a.video_hash
               and cp.status in ('published', 'retired'))`,
        [lessonId, videoHash]
      );
      const supersededAssets = await client.query<{ id: string }>(
        `update jmvstream_video_assets
         set delete_status = 'pending', updated_at = now()
         where lesson_id = $1 and video_hash <> $2 and delete_status = 'none'
           and upload_status in ('processing', 'ready')
         returning id`,
        [lessonId, videoHash]
      );
      const asset = await client.query(
        `update jmvstream_video_assets
         set gallery_uuid = $2, job_id = $3, upload_status = $4, player_url = $7,
             last_error = null, updated_at = now()
         where id = $1 and lesson_id = $5 and video_hash = $6
           and upload_status = 'uploading' and delete_status = 'none'`,
        [
          uploadSessionId,
          galleryUuid,
          jobId,
          uploadStatus,
          lessonId,
          videoHash,
          playerUrl,
        ]
      );
      if (asset.rowCount !== 1) {
        throw new Error("Sessao de upload JMVStream invalida ou expirada.");
      }
      const linked = await client.query(
        `update lessons l
         set video_provider = 'jmvstream', video_external_id = $1,
             video_embed_url = $3, thumbnail_url = $4, updated_at = now()
         from course_publications cp
         where l.id = $2 and cp.id = l.course_publication_id and cp.status = 'draft'`,
        [videoHash, lessonId, playerUrl, thumbnailUrl]
      );
      if (linked.rowCount !== 1) {
        throw new Error("A Aula deixou de pertencer a um rascunho editavel.");
      }
      return supersededAssets.rows.map((supersededAsset) => supersededAsset.id);
    },
  });

export const getJmvstreamLessonVideo = async (
  lessonId: string
): Promise<{ courseId: string; videoHash: string } | null> => {
  const { rows } = await getPool().query<{
    course_id: string;
    video_external_id: string | null;
  }>(
    `
      select m.course_id, l.video_external_id
      from lessons l
      join modules m on m.id = l.module_id
      join course_publications cp on cp.id = l.course_publication_id
      where l.id = $1 and cp.status = 'draft'
      limit 1
    `,
    [lessonId]
  );
  const lesson = rows[0];

  return lesson?.video_external_id
    ? { courseId: lesson.course_id, videoHash: lesson.video_external_id }
    : null;
};

export const recordJmvstreamReadyPlayer = async ({
  courseId,
  lessonId,
  playerUrl,
  thumbnailUrl,
  videoHash,
}: {
  courseId: string;
  lessonId: string;
  playerUrl: string;
  thumbnailUrl: string | null;
  videoHash: string;
}): Promise<void> => {
  await withJmvstreamLessonDraft({
    courseId,
    lessonId,
    operation: async (client) => {
      const linked = await client.query(
        `update lessons l
         set video_embed_url = $1, thumbnail_url = $3, updated_at = now()
         from course_publications cp
         where l.id = $2 and cp.id = l.course_publication_id and cp.status = 'draft'
           and l.video_provider = 'jmvstream' and l.video_external_id = $4
           and exists (select 1 from jmvstream_video_assets a
             where a.video_hash = $4 and a.delete_status = 'none')`,
        [playerUrl, lessonId, thumbnailUrl, videoHash]
      );
      if (linked.rowCount !== 1) {
        throw new Error("O video da Aula mudou durante a sincronizacao.");
      }
      await client.query(
        `update jmvstream_video_assets
         set upload_status = 'ready', player_url = $2, last_error = null, updated_at = now()
         where video_hash = $1 and delete_status = 'none'`,
        [videoHash, playerUrl]
      );
    },
  });
};
export const getPendingJmvstreamPlayerLessons = async (
  limit: number
): Promise<string[]> => {
  const { rows } = await getPool().query<{ lesson_id: string }>(
    `
      select lesson_id
      from jmvstream_video_assets
      where upload_status = 'processing'
        and delete_status = 'none'
        and lesson_id is not null
      order by jmvstream_video_assets.updated_at asc
      limit $1
    `,
    [limit]
  );

  return rows.map((row) => row.lesson_id);
};

export const markJmvstreamAssetMovePending = async ({
  videoHash,
}: {
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set last_error = null,
          updated_at = now()
      where video_hash = $1
        and delete_status <> 'deleted'
    `,
    [videoHash]
  );
};

export const markJmvstreamAssetInGallery = async ({
  galleryUuid,
  videoHash,
}: {
  galleryUuid: string;
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set gallery_uuid = $2,
          last_error = null,
          updated_at = now()
      where video_hash = $1
        and delete_status <> 'deleted'
    `,
    [videoHash, galleryUuid]
  );
};

export const recordJmvstreamAssetMoveFailure = async ({
  lastError,
  videoHash,
}: {
  lastError: string;
  videoHash: string;
}): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set last_error = $2,
          updated_at = now()
      where video_hash = $1
        and delete_status <> 'deleted'
    `,
    [videoHash, lastError]
  );
};

export const touchJmvstreamProcessingAsset = async (
  videoHash: string
): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set updated_at = now()
      where video_hash = $1
        and upload_status = 'processing'
        and delete_status = 'none'
    `,
    [videoHash]
  );
};

export const expireStaleJmvstreamUploads = async (): Promise<void> => {
  await getPool().query(
    `
      update jmvstream_video_assets
      set upload_status = 'failed',
          last_error = $1,
          updated_at = now()
      where upload_status = 'uploading'
        and updated_at < now() - $2::interval
    `,
    [
      "Upload JMVStream expirado antes da finalizacao. Tente enviar novamente ou cancele e limpe a sessao.",
      STALE_UPLOAD_INTERVAL,
    ]
  );
};
