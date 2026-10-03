import "server-only";
import type { PoolClient } from "pg";
import { extractJmvstreamEmbedUrl } from "@/features/videos/jmvstream";

type Queryable = Pick<PoolClient, "query">;

// One shared lock protects cross-Course manual references as well as hashes.
// Acquire before the Course publication lock; never hold it during provider I/O.
export const lockJmvstreamVideoLifecycle = async (
  client: Queryable
): Promise<void> => {
  await client.query(
    "select pg_advisory_xact_lock(hashtextextended('jmvstream-video-lifecycle', 0))"
  );
};

export const normalizeJmvstreamPlayerIdentity = (
  value: string | null
): string | null => {
  const normalized = extractJmvstreamEmbedUrl(value);
  if (!normalized) {
    return null;
  }
  const url = new URL(normalized);
  // Player parameters affect presentation, not the persisted player resource.
  url.search = "";
  url.hash = "";
  return url.href;
};

export const isJmvstreamAssetProtected = async (
  client: Queryable,
  videoHash: string,
  playerUrl: string | null,
  includeDrafts = false
): Promise<boolean> => {
  const { rows } = await client.query<{
    video_external_id: string | null;
    video_embed_url: string | null;
    status: string;
  }>(`select l.video_external_id, l.video_embed_url, cp.status
      from lessons l join course_publications cp on cp.id = l.course_publication_id
      where l.video_provider = 'jmvstream'`);
  const identities = new Set<string>();
  const storedIdentity = normalizeJmvstreamPlayerIdentity(playerUrl);
  if (storedIdentity) {
    identities.add(storedIdentity);
  }
  for (const row of rows) {
    const identity = normalizeJmvstreamPlayerIdentity(row.video_embed_url);
    if (row.video_external_id === videoHash && identity) {
      identities.add(identity);
    }
  }
  return rows.some((row) => {
    if (
      !(includeDrafts || row.status === "published" || row.status === "retired")
    ) {
      return false;
    }
    const identity = normalizeJmvstreamPlayerIdentity(row.video_embed_url);
    // A legacy asset without any stored player identity cannot safely disprove
    // that a published manual player consumes it. Preserve it for reconciliation.
    if (identities.size === 0 && !row.video_external_id && identity) {
      return true;
    }
    return (
      row.video_external_id === videoHash ||
      Boolean(identity && identities.has(identity))
    );
  });
};

export const assertJmvstreamVideoReferenceAvailable = async (
  client: Queryable,
  {
    videoHash,
    playerUrl,
  }: { videoHash: string | null; playerUrl: string | null }
): Promise<void> => {
  const identity = normalizeJmvstreamPlayerIdentity(playerUrl);
  const { rows } = await client.query<{
    video_hash: string;
    player_url: string | null;
  }>(`select video_hash, player_url from jmvstream_video_assets
      where delete_status <> 'none'`);
  for (const row of rows) {
    if (
      (videoHash && row.video_hash === videoHash) ||
      (identity &&
        normalizeJmvstreamPlayerIdentity(row.player_url) === identity)
    ) {
      throw new Error(
        "Este video esta pendente de exclusao ou ja foi excluido."
      );
    }
    if (identity && !row.player_url) {
      const aliases = await client.query<{ video_embed_url: string | null }>(
        "select video_embed_url from lessons where video_provider = 'jmvstream' and video_external_id = $1",
        [row.video_hash]
      );
      if (
        !aliases.rows.some((alias) =>
          normalizeJmvstreamPlayerIdentity(alias.video_embed_url)
        )
      ) {
        throw new Error(
          "A identidade de um video em exclusao precisa ser reconciliada antes de usar links manuais."
        );
      }
      if (
        aliases.rows.some(
          (alias) =>
            normalizeJmvstreamPlayerIdentity(alias.video_embed_url) === identity
        )
      ) {
        throw new Error(
          "Este video esta pendente de exclusao ou ja foi excluido."
        );
      }
    }
  }
};
