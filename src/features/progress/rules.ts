export interface CourseProgressInput {
  completedLessonIds: readonly string[];
  lessonIds: readonly string[];
  requiredLessonIds: readonly string[];
}

export interface CourseProgress {
  completedCount: number;
  percent: number;
  totalCount: number;
}

export const VIDEO_PROGRESS_MAX_FORWARD_DELTA_SECONDS = 30;
export const VIDEO_PROGRESS_FRONTIER_TOLERANCE_SECONDS = 1;

export interface VideoPlaybackProgressState {
  currentPositionSeconds: number;
  isAwaitingPlaybackAfterSeek: boolean;
  isLinearProgressBlocked: boolean;
  maxPositionSeconds: number;
  playingTimeSeconds: number;
  resumePositionSeconds: number;
  validatedPositionSeconds: number;
}

export interface VideoPlaybackProgressInput {
  currentSeconds: number;
  durationSeconds: number;
  isPaused: boolean;
  isSkipEvent: boolean;
  previous: VideoPlaybackProgressState;
}

export const calculateCourseProgress = ({
  completedLessonIds,
  requiredLessonIds,
}: CourseProgressInput): CourseProgress => {
  const lessonIdSet = new Set(requiredLessonIds);
  const completedCount = new Set(
    completedLessonIds.filter((lessonId) => lessonIdSet.has(lessonId))
  ).size;
  const totalCount = lessonIdSet.size;

  return {
    completedCount,
    totalCount,
    percent:
      totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100),
  };
};

export const getNextAvailableLessonId = ({
  lessonIds,
  completedLessonIds,
}: Pick<CourseProgressInput, "completedLessonIds" | "lessonIds">):
  | string
  | null => {
  const completed = new Set(completedLessonIds);
  return lessonIds.find((lessonId) => !completed.has(lessonId)) ?? null;
};

export const getNextAvailablePendingLessonId = (
  lessons: Array<{
    availability: { kind: "available" | "sequence_locked" | "time_locked" };
    id: string;
    isCompleted: boolean;
  }>
): string | null =>
  lessons.find(
    (lesson) => !lesson.isCompleted && lesson.availability.kind === "available"
  )?.id ?? null;

export interface AutomaticLessonCandidate {
  id: string;
  isAvailable: boolean;
  isCompleted: boolean;
}

export const getNextAutomaticLessonId = (
  lessons: readonly AutomaticLessonCandidate[],
  currentLessonId: string
): string | null => {
  const currentIndex = lessons.findIndex(
    (lesson) => lesson.id === currentLessonId
  );
  if (currentIndex === -1) {
    return null;
  }

  const findPendingLesson = (startIndex: number): string | null =>
    lessons
      .slice(startIndex)
      .find((lesson) => !lesson.isCompleted && lesson.isAvailable)?.id ?? null;

  const nextForwardLessonId = findPendingLesson(currentIndex + 1);
  if (nextForwardLessonId) {
    return nextForwardLessonId;
  }

  if (currentIndex < lessons.length - 1) {
    return null;
  }

  return findPendingLesson(0);
};

export const isLessonAvailable = ({
  lessonIds,
  completedLessonIds,
  requiredLessonIds,
  lessonId,
}: CourseProgressInput & {
  lessonId: string;
}): boolean => {
  const targetIndex = lessonIds.indexOf(lessonId);
  if (targetIndex === -1) {
    return false;
  }

  const completed = new Set(completedLessonIds);

  if (completed.has(lessonId)) {
    return true;
  }

  for (const requiredLessonId of requiredLessonIds) {
    const requiredIndex = lessonIds.indexOf(requiredLessonId);
    if (requiredIndex < targetIndex && !completed.has(requiredLessonId)) {
      return false;
    }
  }

  return true;
};

export const advanceVideoPlaybackProgress = ({
  currentSeconds,
  durationSeconds,
  isPaused,
  isSkipEvent,
  previous,
}: VideoPlaybackProgressInput): VideoPlaybackProgressState => {
  const safeDurationSeconds = Math.max(1, Math.round(durationSeconds));
  const currentPositionSeconds = clampVideoPosition(
    currentSeconds,
    safeDurationSeconds
  );
  const previousCurrentPositionSeconds = clampVideoPosition(
    previous.currentPositionSeconds,
    safeDurationSeconds
  );
  const previousResumePositionSeconds = clampVideoPosition(
    previous.resumePositionSeconds,
    safeDurationSeconds
  );
  const previousValidatedPositionSeconds = clampVideoPosition(
    previous.validatedPositionSeconds,
    safeDurationSeconds
  );
  const maxPositionSeconds = Math.max(
    clampVideoPosition(previous.maxPositionSeconds, safeDurationSeconds),
    currentPositionSeconds
  );

  if (isSkipEvent) {
    return {
      currentPositionSeconds,
      isAwaitingPlaybackAfterSeek: true,
      isLinearProgressBlocked:
        previous.isLinearProgressBlocked ||
        currentPositionSeconds >
          previousValidatedPositionSeconds +
            VIDEO_PROGRESS_FRONTIER_TOLERANCE_SECONDS,
      maxPositionSeconds,
      playingTimeSeconds: previous.playingTimeSeconds,
      resumePositionSeconds: previousResumePositionSeconds,
      validatedPositionSeconds: previousValidatedPositionSeconds,
    };
  }

  if (previous.isAwaitingPlaybackAfterSeek) {
    const returnedToValidatedFrontier =
      !isPaused &&
      currentPositionSeconds <=
        previousValidatedPositionSeconds +
          VIDEO_PROGRESS_FRONTIER_TOLERANCE_SECONDS;
    const postSeekPlaybackDeltaSeconds =
      !isPaused &&
      currentPositionSeconds > previousCurrentPositionSeconds &&
      currentPositionSeconds - previousCurrentPositionSeconds <=
        VIDEO_PROGRESS_MAX_FORWARD_DELTA_SECONDS
        ? currentPositionSeconds - previousCurrentPositionSeconds
        : 0;

    return {
      currentPositionSeconds,
      isAwaitingPlaybackAfterSeek: isPaused,
      isLinearProgressBlocked: returnedToValidatedFrontier
        ? false
        : previous.isLinearProgressBlocked,
      maxPositionSeconds,
      playingTimeSeconds:
        Math.max(0, Math.round(previous.playingTimeSeconds)) +
        Math.round(postSeekPlaybackDeltaSeconds),
      resumePositionSeconds:
        postSeekPlaybackDeltaSeconds > 0
          ? currentPositionSeconds
          : previousResumePositionSeconds,
      validatedPositionSeconds: previousValidatedPositionSeconds,
    };
  }

  const forwardDeltaSeconds =
    currentPositionSeconds - previousCurrentPositionSeconds;
  if (forwardDeltaSeconds > VIDEO_PROGRESS_MAX_FORWARD_DELTA_SECONDS) {
    return {
      currentPositionSeconds,
      isAwaitingPlaybackAfterSeek: true,
      isLinearProgressBlocked:
        previous.isLinearProgressBlocked ||
        currentPositionSeconds >
          previousValidatedPositionSeconds +
            VIDEO_PROGRESS_FRONTIER_TOLERANCE_SECONDS,
      maxPositionSeconds,
      playingTimeSeconds: previous.playingTimeSeconds,
      resumePositionSeconds: previousResumePositionSeconds,
      validatedPositionSeconds: previousValidatedPositionSeconds,
    };
  }

  const playingTimeDeltaSeconds = Math.max(0, forwardDeltaSeconds);
  let isLinearProgressBlocked = previous.isLinearProgressBlocked;
  let validatedPositionSeconds = previousValidatedPositionSeconds;

  if (
    isLinearProgressBlocked &&
    currentPositionSeconds <=
      previousValidatedPositionSeconds +
        VIDEO_PROGRESS_FRONTIER_TOLERANCE_SECONDS
  ) {
    isLinearProgressBlocked = false;
  }

  if (
    !isLinearProgressBlocked &&
    currentPositionSeconds > validatedPositionSeconds
  ) {
    if (
      currentPositionSeconds - validatedPositionSeconds <=
      VIDEO_PROGRESS_MAX_FORWARD_DELTA_SECONDS
    ) {
      validatedPositionSeconds = currentPositionSeconds;
    } else {
      isLinearProgressBlocked = true;
    }
  }

  return {
    currentPositionSeconds,
    isAwaitingPlaybackAfterSeek: false,
    isLinearProgressBlocked,
    maxPositionSeconds,
    playingTimeSeconds:
      Math.max(0, Math.round(previous.playingTimeSeconds)) +
      Math.round(playingTimeDeltaSeconds),
    resumePositionSeconds: currentPositionSeconds,
    validatedPositionSeconds,
  };
};

export const calculateValidatedVideoPercent = ({
  durationSeconds,
  validatedPositionSeconds,
}: {
  durationSeconds: number;
  validatedPositionSeconds: number;
}): number => {
  const safeDurationSeconds = Math.max(1, Math.round(durationSeconds));
  const safeValidatedPositionSeconds = clampVideoPosition(
    validatedPositionSeconds,
    safeDurationSeconds
  );

  return Math.min(
    100,
    Math.floor((safeValidatedPositionSeconds / safeDurationSeconds) * 100)
  );
};

const clampVideoPosition = (value: number, durationSeconds: number): number =>
  Math.min(durationSeconds, Math.max(0, Math.round(value)));
