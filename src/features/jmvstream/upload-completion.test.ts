import { beforeEach, describe, expect, it, vi } from "vitest";

const { persistCompletion, retryDelete, completeMultipartUpload, markFailed } =
  vi.hoisted(() => ({
    persistCompletion: vi.fn(),
    retryDelete: vi.fn(),
    completeMultipartUpload: vi.fn(),
    markFailed: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("./asset-deletion", () => ({
  deleteReplacedJmvstreamAssets: retryDelete,
}));
vi.mock("./asset-persistence", () => ({
  assertJmvstreamUploadSessionMatches: vi.fn(),
  assertJmvstreamVideoHashAvailable: vi.fn(),
  getJmvstreamLessonContext: async () => ({ course_id: "course-1" }),
  markJmvstreamUploadFailed: markFailed,
  recordCompletedJmvstreamUpload: persistCompletion,
}));
vi.mock("./auth", () => ({
  getConfiguredJmvstreamClient: async () => ({
    completeMultipartUpload,
    getVideo: async () => null,
  }),
}));
vi.mock("./course-folders", () => ({
  requireJmvstreamCourseFolder: async () => "gallery-1",
}));
vi.mock("./player-sync", () => ({
  moveJmvstreamVideoToCourseFolder: vi.fn(),
  resolveJmvstreamPlayerThumbnailUrl: async () => null,
}));

import { completeJmvstreamUpload } from "./upload-completion";

const completeUpload = (videoHash: string): Promise<void> =>
  completeJmvstreamUpload({
    filename: "video.mp4",
    lessonId: "lesson-1",
    objectName: videoHash,
    parts: [],
    size: 100,
    uploadId: videoHash,
    uploadSessionId: videoHash,
    videoHash,
  });

describe("replacement upload cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeMultipartUpload.mockImplementation(({ videoHash }) => ({
      jobId: "job-1",
      playerUrl: "https://player.example/video",
      videoHash,
    }));
  });

  it("scopes provider completion failures to the original uploading session", async () => {
    completeMultipartUpload.mockRejectedValue(
      new Error("duplicate completion failed")
    );
    await expect(completeUpload("video-a")).rejects.toThrow(
      "duplicate completion failed"
    );
    expect(markFailed).toHaveBeenCalledWith({
      lastError: "duplicate completion failed",
      uploadSessionId: "video-a",
      videoHash: "video-a",
    });
    expect(persistCompletion).not.toHaveBeenCalled();
    expect(retryDelete).not.toHaveBeenCalled();
  });

  it("cleans only the captured replacement assets when another completion wins before cleanup", async () => {
    let releaseFirstCompletion: (ids: string[]) => void = () => undefined;
    let markFirstLinked: () => void = () => undefined;
    const firstLinked = new Promise<void>((resolve) => {
      markFirstLinked = resolve;
    });
    const firstCompletion = new Promise<string[]>((resolve) => {
      releaseFirstCompletion = resolve;
    });
    let currentVideo = "old-video";
    persistCompletion.mockImplementation(
      ({ videoHash }: { videoHash: string }) => {
        currentVideo = videoHash;
        if (videoHash === "video-a") {
          markFirstLinked();
          return firstCompletion;
        }
        return Promise.resolve(["video-a"]);
      }
    );
    retryDelete.mockImplementation((assetIds: string[]) => {
      expect(assetIds).not.toContain(currentVideo);
      expect(assetIds).not.toContain("uploading-video-c");
      return { attempted: assetIds.length, failed: 0 };
    });

    const first = completeUpload("video-a");
    await firstLinked;
    await completeUpload("video-b");
    releaseFirstCompletion(["old-video"]);
    await first;

    expect(currentVideo).toBe("video-b");
    expect(retryDelete.mock.calls.map(([assetIds]) => assetIds)).toEqual([
      ["video-a"],
      ["old-video"],
    ]);
  });
});
