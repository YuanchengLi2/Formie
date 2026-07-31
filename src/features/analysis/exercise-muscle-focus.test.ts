import { resolveExerciseMuscleFocus } from "./exercise-muscle-focus";

describe("resolveExerciseMuscleFocus", () => {
  it("maps a declared bench press to its actual target muscles", () => {
    expect(resolveExerciseMuscleFocus("Dumbbell Bench Press")).toEqual({
      primary: [{ name: "Pectorals", region: "chest" }],
      secondary: [
        { name: "Front shoulders", region: "front_shoulders" },
        { name: "Triceps", region: "triceps" },
      ],
      unclassified: [],
    });
  });

  it.each([
    [
      "One-Arm Dumbbell Row",
      [{ name: "Latissimus dorsi", region: "lats" }, { name: "Upper back", region: "upper_back" }],
      [{ name: "Rear shoulders", region: "rear_shoulders" }, { name: "Biceps", region: "biceps" }],
    ],
    [
      "Back Squat",
      [{ name: "Quadriceps", region: "quads" }, { name: "Glutes", region: "glutes" }],
      [{ name: "Hamstrings", region: "hamstrings" }, { name: "Adductors", region: "adductors" }],
    ],
    [
      "Romanian Deadlift",
      [{ name: "Hamstrings", region: "hamstrings" }, { name: "Glutes", region: "glutes" }],
      [{ name: "Lower back", region: "lower_back" }, { name: "Adductors", region: "adductors" }],
    ],
  ])("maps %s deterministically", (exercise, primary, secondary) => {
    expect(resolveExerciseMuscleFocus(exercise)).toEqual({
      primary,
      secondary,
      unclassified: [],
    });
  });

  it("returns null for an unknown custom exercise instead of guessing", () => {
    expect(resolveExerciseMuscleFocus("My custom cable movement")).toBeNull();
  });
});
