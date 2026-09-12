import { describe, expect, it } from "vitest";
import {
  advanceVideoPlaybackProgress,
  calculateCourseProgress,
  calculateValidatedVideoPercent,
  getNextAutomaticLessonId,
  getNextAvailableLessonId,
  isLessonAvailable,
  type VideoPlaybackProgressState,
} from "./rules";

const lessonIds = ["l1", "l2", "l3", "l4"] as const;

describe("course progress rules", () => {
  it("calculates completion percentage from unique completed lessons", () => {
    expect(
      calculateCourseProgress({
        lessonIds: [...lessonIds],
        completedLessonIds: ["l1", "l1", "l3"],
        requiredLessonIds: [...lessonIds],
      })
    ).toEqual({
      completedCount: 2,
      totalCount: 4,
      percent: 50,
    });
  });

  it("calculates course completion from required lessons only", () => {
    expect(
      calculateCourseProgress({
        lessonIds: ["required-one", "optional", "required-two"],
        requiredLessonIds: ["required-one", "required-two"],
        completedLessonIds: ["required-one", "optional"],
      })
    ).toEqual({
      completedCount: 1,
      percent: 50,
      totalCount: 2,
    });
  });

  it("lets optional lessons be skipped without blocking later required lessons", () => {
    const sequence = [
      "required-a",
      "optional-b",
      "optional-c",
      "required-d",
      "required-e",
    ];

    expect(
      isLessonAvailable({
        lessonIds: sequence,
        completedLessonIds: ["required-a"],
        requiredLessonIds: ["required-a", "required-d", "required-e"],
        lessonId: "optional-b",
      })
    ).toBe(true);
    expect(
      isLessonAvailable({
        lessonIds: sequence,
        completedLessonIds: ["required-a"],
        requiredLessonIds: ["required-a", "required-d", "required-e"],
        lessonId: "optional-c",
      })
    ).toBe(true);
    expect(
      isLessonAvailable({
        lessonIds: sequence,
        completedLessonIds: ["required-a"],
        requiredLessonIds: ["required-a", "required-d", "required-e"],
        lessonId: "required-d",
      })
    ).toBe(true);
    expect(
      isLessonAvailable({
        lessonIds: sequence,
        completedLessonIds: ["required-a"],
        requiredLessonIds: ["required-a", "required-d", "required-e"],
        lessonId: "required-e",
      })
    ).toBe(false);
  });

  it("releases optional lessons before the first required lesson", () => {
    const sequence = ["optional-first", "required-a", "required-b"];

    expect(
      isLessonAvailable({
        lessonIds: sequence,
        completedLessonIds: [],
        requiredLessonIds: ["required-a", "required-b"],
        lessonId: "optional-first",
      })
    ).toBe(true);
    expect(
      isLessonAvailable({
        lessonIds: sequence,
        completedLessonIds: [],
        requiredLessonIds: ["required-a", "required-b"],
        lessonId: "required-a",
      })
    ).toBe(true);
    expect(
      isLessonAvailable({
        lessonIds: sequence,
        completedLessonIds: [],
        requiredLessonIds: ["required-a", "required-b"],
        lessonId: "required-b",
      })
    ).toBe(false);
  });

  it("returns the next available lesson after the last completed lesson", () => {
    expect(
      getNextAvailableLessonId({
        lessonIds: [...lessonIds],
        completedLessonIds: ["l1", "l2"],
      })
    ).toBe("l3");
  });

  it("keeps automatic completion navigation moving forward", () => {
    expect(
      getNextAutomaticLessonId(
        [
          { id: "required-a", isAvailable: true, isCompleted: true },
          { id: "optional-b", isAvailable: true, isCompleted: false },
          { id: "required-c", isAvailable: true, isCompleted: true },
          { id: "required-d", isAvailable: true, isCompleted: false },
        ],
        "required-c"
      )
    ).toBe("required-d");
  });

  it("restarts automatic completion navigation at the beginning only at the end", () => {
    expect(
      getNextAutomaticLessonId(
        [
          { id: "required-a", isAvailable: true, isCompleted: true },
          { id: "optional-b", isAvailable: true, isCompleted: false },
          { id: "required-c", isAvailable: true, isCompleted: true },
        ],
        "required-c"
      )
    ).toBe("optional-b");

    expect(
      getNextAutomaticLessonId(
        [
          { id: "required-a", isAvailable: true, isCompleted: true },
          { id: "optional-b", isAvailable: true, isCompleted: false },
          { id: "required-c", isAvailable: true, isCompleted: false },
        ],
        "required-a"
      )
    ).toBe("optional-b");
  });

  it("advances the validated frontier only during normal playback", () => {
    const initial: VideoPlaybackProgressState = {
      currentPositionSeconds: 0,
      isAwaitingPlaybackAfterSeek: false,
      isLinearProgressBlocked: false,
      maxPositionSeconds: 0,
      playingTimeSeconds: 0,
      resumePositionSeconds: 0,
      validatedPositionSeconds: 0,
    };

    const watched = advanceVideoPlaybackProgress({
      currentSeconds: 30,
      durationSeconds: 1000,
      isPaused: false,
      isSkipEvent: false,
      previous: initial,
    });

    expect(watched).toMatchObject({
      currentPositionSeconds: 30,
      maxPositionSeconds: 30,
      playingTimeSeconds: 30,
      resumePositionSeconds: 30,
      validatedPositionSeconds: 30,
    });
  });

  it("does not validate or resume at a forward skip target", () => {
    const watched: VideoPlaybackProgressState = {
      currentPositionSeconds: 30,
      isAwaitingPlaybackAfterSeek: false,
      isLinearProgressBlocked: false,
      maxPositionSeconds: 30,
      playingTimeSeconds: 30,
      resumePositionSeconds: 30,
      validatedPositionSeconds: 30,
    };

    const skipped = advanceVideoPlaybackProgress({
      currentSeconds: 950,
      durationSeconds: 1000,
      isPaused: false,
      isSkipEvent: true,
      previous: watched,
    });

    expect(skipped).toEqual({
      currentPositionSeconds: 950,
      isAwaitingPlaybackAfterSeek: true,
      isLinearProgressBlocked: true,
      maxPositionSeconds: 950,
      playingTimeSeconds: 30,
      resumePositionSeconds: 30,
      validatedPositionSeconds: 30,
    });
  });

  it("counts playback after a skip without advancing the blocked frontier", () => {
    const skipped: VideoPlaybackProgressState = {
      currentPositionSeconds: 950,
      isAwaitingPlaybackAfterSeek: false,
      isLinearProgressBlocked: true,
      maxPositionSeconds: 950,
      playingTimeSeconds: 30,
      resumePositionSeconds: 30,
      validatedPositionSeconds: 30,
    };

    const afterPlayback = advanceVideoPlaybackProgress({
      currentSeconds: 960,
      durationSeconds: 1000,
      isPaused: false,
      isSkipEvent: false,
      previous: skipped,
    });

    expect(afterPlayback).toMatchObject({
      currentPositionSeconds: 960,
      isLinearProgressBlocked: true,
      playingTimeSeconds: 40,
      resumePositionSeconds: 960,
      validatedPositionSeconds: 30,
    });
  });

  it("reopens the linear frontier after the student returns and watches from it", () => {
    const returnedAfterSkip = advanceVideoPlaybackProgress({
      currentSeconds: 30,
      durationSeconds: 1000,
      isPaused: false,
      isSkipEvent: false,
      previous: {
        currentPositionSeconds: 950,
        isAwaitingPlaybackAfterSeek: true,
        isLinearProgressBlocked: true,
        maxPositionSeconds: 950,
        playingTimeSeconds: 30,
        resumePositionSeconds: 960,
        validatedPositionSeconds: 30,
      },
    });
    const continued = advanceVideoPlaybackProgress({
      currentSeconds: 40,
      durationSeconds: 1000,
      isPaused: false,
      isSkipEvent: false,
      previous: returnedAfterSkip,
    });

    expect(returnedAfterSkip.isLinearProgressBlocked).toBe(false);
    expect(continued.validatedPositionSeconds).toBe(40);
    expect(continued.playingTimeSeconds).toBe(40);
  });

  it("does not count the first restored or post-seek position as playback", () => {
    const afterSeek = advanceVideoPlaybackProgress({
      currentSeconds: 950,
      durationSeconds: 1000,
      isPaused: false,
      isSkipEvent: false,
      previous: {
        currentPositionSeconds: 30,
        isAwaitingPlaybackAfterSeek: true,
        isLinearProgressBlocked: true,
        maxPositionSeconds: 950,
        playingTimeSeconds: 30,
        resumePositionSeconds: 30,
        validatedPositionSeconds: 30,
      },
    });

    expect(afterSeek).toMatchObject({
      isAwaitingPlaybackAfterSeek: false,
      playingTimeSeconds: 30,
      resumePositionSeconds: 30,
      validatedPositionSeconds: 30,
    });
  });

  it("counts the first normal seconds after a seek without validating the gap", () => {
    const afterSeekPlayback = advanceVideoPlaybackProgress({
      currentSeconds: 960,
      durationSeconds: 1000,
      isPaused: false,
      isSkipEvent: false,
      previous: {
        currentPositionSeconds: 950,
        isAwaitingPlaybackAfterSeek: true,
        isLinearProgressBlocked: true,
        maxPositionSeconds: 950,
        playingTimeSeconds: 30,
        resumePositionSeconds: 30,
        validatedPositionSeconds: 30,
      },
    });

    expect(afterSeekPlayback).toMatchObject({
      isAwaitingPlaybackAfterSeek: false,
      isLinearProgressBlocked: true,
      playingTimeSeconds: 40,
      resumePositionSeconds: 960,
      validatedPositionSeconds: 30,
    });
  });

  it("calculates the visible video percent from the validated frontier", () => {
    expect(
      calculateValidatedVideoPercent({
        durationSeconds: 100,
        validatedPositionSeconds: 30,
      })
    ).toBe(30);
  });
});
