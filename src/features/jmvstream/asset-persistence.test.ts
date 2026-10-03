import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
const release = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ query, connect: async () => ({ query, release }) }),
}));

import {
  discardJmvstreamUpload,
  getJmvstreamLessonContext,
  getJmvstreamLessonVideo,
  markJmvstreamUploadFailed,
  recordCompletedJmvstreamUpload,
  recordJmvstreamReadyPlayer,
} from "./asset-persistence";

const normalizeSql = (value: unknown): string =>
  String(value).replace(/\s+/g, " ").trim().toLowerCase();

describe("JMVStream lesson publication boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it("loads upload context only for lessons in a draft publication", async () => {
    await expect(getJmvstreamLessonContext("lesson-1")).resolves.toBeNull();

    const sql = normalizeSql(query.mock.calls[0]?.[0]);
    expect(sql).toContain(
      "join course_publications cp on cp.id = l.course_publication_id"
    );
    expect(sql).toContain("cp.status = 'draft'");
    expect(query.mock.calls[0]?.[1]).toEqual(["lesson-1"]);
  });

  it("loads a lesson video for manual synchronization only from a draft publication", async () => {
    await expect(getJmvstreamLessonVideo("lesson-1")).resolves.toBeNull();

    const sql = normalizeSql(query.mock.calls[0]?.[0]);
    expect(sql).toContain(
      "join course_publications cp on cp.id = l.course_publication_id"
    );
    expect(sql).toContain("cp.status = 'draft'");
    expect(query.mock.calls[0]?.[1]).toEqual(["lesson-1"]);
  });

  it("does not turn a published manual player into a failed upload", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.startsWith("select video_hash")) {
        return {
          rows: [
            {
              video_hash: "video-1",
              player_url: "https://player.jmvstream.com/player-a",
            },
          ],
        };
      }
      if (sql.includes("cp.status")) {
        return {
          rows: [
            {
              video_external_id: null,
              video_embed_url: "https://player.jmvstream.com/player-a",
              status: "published",
            },
          ],
        };
      }
      return { rows: [] };
    });
    await markJmvstreamUploadFailed({
      lastError: "processing failed",
      videoHash: "video-1",
    });
    expect(
      query.mock.calls.some(([sql]) => normalizeSql(sql).startsWith("update"))
    ).toBe(false);
  });

  it("does not discard a failed asset still consumed by a manual draft", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.startsWith("select video_hash")) {
        return {
          rows: [
            {
              video_hash: "video-1",
              player_url: "https://player.jmvstream.com/player-a",
            },
          ],
        };
      }
      if (sql.includes("cp.status")) {
        return {
          rows: [
            {
              video_external_id: null,
              video_embed_url: "https://player.jmvstream.com/player-a",
              status: "draft",
            },
          ],
        };
      }
      return { rows: [] };
    });
    await discardJmvstreamUpload({ assetId: "asset-1" });
    expect(
      query.mock.calls.some(([sql]) => normalizeSql(sql).startsWith("update"))
    ).toBe(false);
  });

  it("guards a stale provider failure against an already completed upload session", async () => {
    query.mockImplementation((sql: string) => ({
      rows: sql.startsWith("select video_hash")
        ? [{ video_hash: "video-1", player_url: null }]
        : [],
      rowCount: 0,
    }));
    await markJmvstreamUploadFailed({
      lastError: "duplicate completion failed",
      uploadSessionId: "session-1",
      videoHash: "video-1",
    });
    const updateCall = query.mock.calls.find(([statement]) =>
      normalizeSql(statement).startsWith("update jmvstream_video_assets")
    );
    const sql = normalizeSql(updateCall?.[0]);
    expect(sql).toContain(
      "id = $3 and upload_status = 'uploading' and delete_status = 'none'"
    );
    expect(updateCall?.[1]).toEqual([
      "video-1",
      "duplicate completion failed",
      "session-1",
    ]);
  });

  it("preserves the published lesson and upload record when completion finishes after publication", async () => {
    await expect(
      recordCompletedJmvstreamUpload({
        filename: "video.mp4",
        galleryUuid: "gallery-1",
        jobId: "job-1",
        lesson: {
          course_id: "course-1",
          course_title: "Course",
          lesson_title: "Lesson",
          module_id: "module-1",
          module_title: "Module",
        },
        lessonId: "lesson-1",
        objectName: "object-1",
        playerUrl: "https://player.example/video-1",
        size: 100,
        thumbnailUrl: null,
        uploadId: "upload-1",
        uploadSessionId: "session-1",
        uploadStatus: "ready",
        videoHash: "video-1",
      })
    ).rejects.toThrow("rascunho editavel");
    expect(
      query.mock.calls.some(([sql]) => normalizeSql(sql).startsWith("update"))
    ).toBe(false);
    expect(query).toHaveBeenCalledWith("rollback");
  });

  it("does not mark the old video ready when the lesson changed during provider synchronization", async () => {
    query.mockImplementation((sql: string) => ({
      rows: sql.includes("for update of l") ? [{ id: "lesson-1" }] : [],
      rowCount: 0,
    }));
    await expect(
      recordJmvstreamReadyPlayer({
        courseId: "course-1",
        lessonId: "lesson-1",
        playerUrl: "https://player.example/old-video",
        thumbnailUrl: null,
        videoHash: "old-video",
      })
    ).rejects.toThrow("mudou durante");
    expect(
      query.mock.calls.some(([sql]) =>
        normalizeSql(sql).startsWith("update jmvstream_video_assets")
      )
    ).toBe(false);
    expect(query).toHaveBeenCalledWith("rollback");
  });

  it("returns only the superseded assets captured in the replacement transaction", async () => {
    query.mockImplementation((sql: string) => {
      const normalized = normalizeSql(sql);
      if (normalized.includes("for update of l")) {
        return { rows: [{ id: "lesson-1" }], rowCount: 1 };
      }
      if (normalized.startsWith("select id from jmvstream_video_assets")) {
        return { rows: [{ id: "session-1" }], rowCount: 1 };
      }
      if (
        normalized.startsWith(
          "update jmvstream_video_assets set delete_status = 'pending'"
        )
      ) {
        expect(normalized).toContain(
          "upload_status in ('processing', 'ready')"
        );
        expect(normalized).toContain("returning id");
        return { rows: [{ id: "old-asset" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    await expect(
      recordCompletedJmvstreamUpload({
        filename: "video.mp4",
        galleryUuid: "gallery-1",
        jobId: "job-1",
        lesson: {
          course_id: "course-1",
          course_title: "Course",
          lesson_title: "Lesson",
          module_id: "module-1",
          module_title: "Module",
        },
        lessonId: "lesson-1",
        objectName: "object-1",
        playerUrl: "https://player.example/video-1",
        size: 100,
        thumbnailUrl: null,
        uploadId: "upload-1",
        uploadSessionId: "session-1",
        uploadStatus: "ready",
        videoHash: "video-1",
      })
    ).resolves.toEqual(["old-asset"]);
    expect(query).toHaveBeenCalledWith("commit");
  });
});
