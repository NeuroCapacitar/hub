import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assertJmvstreamVideoReferenceAvailable,
  isJmvstreamAssetProtected,
} from "./asset-lifecycle";

describe("manual JMVStream player lifecycle", () => {
  it("blocks a new manual consumer after deletion was claimed for an unknown legacy identity", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ video_hash: "legacy", player_url: null }],
      })
      .mockResolvedValueOnce({ rows: [] });
    await expect(
      assertJmvstreamVideoReferenceAvailable(
        { query },
        {
          videoHash: null,
          playerUrl: "https://player.jmvstream.com/new-manual",
        }
      )
    ).rejects.toThrow("reconciliada");
  });
  it("protects a manual published reference across Courses using a stored URL", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          status: "published",
          video_external_id: null,
          video_embed_url:
            "https://player.jmvstream.com/player-a?autoplay=1#position",
        },
      ],
    });
    expect(
      await isJmvstreamAssetProtected(
        { query },
        "asset-hash",
        "https://player.jmvstream.com/player-a"
      )
    ).toBe(true);
  });

  it("protects retired manual references even after the original draft disappears", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          status: "retired",
          video_external_id: null,
          video_embed_url: "https://player.jmvstream.com/player-a",
        },
      ],
    });
    expect(
      await isJmvstreamAssetProtected(
        { query },
        "asset-hash",
        "https://player.jmvstream.com/player-a"
      )
    ).toBe(true);
  });

  it("retains legacy unknown identities while a protected manual player exists", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          status: "published",
          video_external_id: null,
          video_embed_url: "https://player.jmvstream.com/legacy",
        },
      ],
    });
    expect(
      await isJmvstreamAssetProtected({ query }, "legacy-hash", null)
    ).toBe(true);
  });

  it("allows deleting an unrelated known player", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          status: "published",
          video_external_id: null,
          video_embed_url: "https://player.jmvstream.com/player-b",
        },
      ],
    });
    expect(
      await isJmvstreamAssetProtected(
        { query },
        "asset-hash",
        "https://player.jmvstream.com/player-a"
      )
    ).toBe(false);
  });

  it("rejects a manual save against an asset already claimed for deletion", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          video_hash: "asset-hash",
          player_url: "https://player.jmvstream.com/player-a",
        },
      ],
    });
    await expect(
      assertJmvstreamVideoReferenceAvailable(
        { query },
        {
          videoHash: null,
          playerUrl: "https://player.jmvstream.com/player-a?autoplay=0",
        }
      )
    ).rejects.toThrow("exclusao");
  });
});
