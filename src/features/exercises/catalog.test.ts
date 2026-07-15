import { EXERCISES, findExercise } from "./catalog";

const EXPECTED_NAMES = [
  "Barbell Bench Press",
  "Incline Dumbbell Press",
  "Dumbbell Bench Press",
  "Incline Barbell Bench Press",
  "Push-Up",
  "Machine Chest Press",
  "Cable Fly",
  "Conventional Deadlift",
  "Lat Pulldown",
  "Pull-Up",
  "Seated Cable Row",
  "One-Arm Dumbbell Row",
  "Barbell Bent-Over Row",
  "Chest-Supported Row",
  "Face Pull",
  "Romanian Deadlift",
  "Back Squat",
  "Front Squat",
  "Goblet Squat",
  "Leg Press",
  "Bulgarian Split Squat",
  "Walking Lunge",
  "Reverse Lunge",
  "Leg Extension",
  "Seated Leg Curl",
  "Hip Thrust",
  "Standing Calf Raise",
  "Barbell Overhead Press",
  "Dumbbell Shoulder Press",
  "Dumbbell Lateral Raise",
  "Dumbbell Front Raise",
  "Rear-Delt Fly",
  "Upright Row",
  "Dumbbell Shrug",
  "Standing Dumbbell Curl",
  "Hammer Curl",
  "Barbell Curl",
  "Cable Curl",
  "Preacher Curl",
  "Cable Triceps Pushdown",
  "Overhead Triceps Extension",
  "Skull Crusher",
  "Parallel-Bar Dip",
  "Close-Grip Bench Press",
  "Front Plank",
  "Side Plank",
  "Crunch",
  "Hanging Leg Raise",
  "Cable Crunch",
  "Ab Wheel Rollout",
] as const;

describe("exercise catalog", () => {
  it("contains exactly the 50 launch exercises", () => {
    expect(EXERCISES.map((exercise) => exercise.name)).toEqual(EXPECTED_NAMES);
  });

  it("uses unique stable ids and slugs", () => {
    expect(new Set(EXERCISES.map((exercise) => exercise.id)).size).toBe(50);
    expect(new Set(EXERCISES.map((exercise) => exercise.slug)).size).toBe(50);
  });

  it("keeps common faults as non-exclusive AI context", () => {
    for (const exercise of EXERCISES) {
      expect(exercise.profile.analysisInstruction).toContain("not an exhaustive list");
      expect(exercise.profile.analysisInstruction).toContain("complete video");
    }
  });

  it("finds an exercise by slug", () => {
    expect(findExercise("standing-dumbbell-curl")?.name).toBe("Standing Dumbbell Curl");
    expect(findExercise("missing-exercise")).toBeUndefined();
  });
});
