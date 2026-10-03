ALTER TABLE "jmvstream_video_assets" ADD COLUMN "player_url" text;
--> statement-breakpoint
UPDATE jmvstream_video_assets asset
SET player_url = source.player_url
FROM (
  SELECT video_external_id AS video_hash, min(video_embed_url) AS player_url
  FROM lessons
  WHERE video_provider = 'jmvstream'
    AND video_external_id IS NOT NULL
    AND video_embed_url LIKE 'https://player.jmvstream.com/%'
  GROUP BY video_external_id
  HAVING count(DISTINCT video_embed_url) = 1
) source
WHERE asset.video_hash = source.video_hash AND asset.player_url IS NULL;
