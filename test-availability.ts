import {
  getNextAvailableLessonId,
  isLessonAvailable,
} from "./src/features/progress/rules";

const lessonIds = ["L4", "L1", "L2", "L3"];
const completedLessonIds = ["L1", "L2"];
const requiredLessonIds = lessonIds;

console.log(
  "nextAvailable:",
  getNextAvailableLessonId({
    lessonIds,
    completedLessonIds,
  })
);
console.log(
  "L4 isAvailable:",
  isLessonAvailable({
    lessonIds,
    completedLessonIds,
    requiredLessonIds,
    lessonId: "L4",
  })
);
console.log(
  "L3 isAvailable:",
  isLessonAvailable({
    lessonIds,
    completedLessonIds,
    requiredLessonIds,
    lessonId: "L3",
  })
);
