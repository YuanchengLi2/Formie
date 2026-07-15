import { searchExercises } from "./search";

describe("searchExercises", () => {
  it("searches names and aliases without case sensitivity", () => {
    expect(searchExercises("RDL").map((item) => item.slug)).toContain("romanian-deadlift");
    expect(searchExercises("CURL").map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "Standing Dumbbell Curl",
        "Hammer Curl",
        "Barbell Curl",
        "Cable Curl",
        "Preacher Curl",
        "Seated Leg Curl",
      ]),
    );
  });

  it("filters by category", () => {
    const arms = searchExercises("", "Arms");
    expect(arms).toHaveLength(10);
    expect(arms.every((item) => item.category === "Arms")).toBe(true);
  });

  it("trims the query and returns catalog order", () => {
    expect(searchExercises("  press ").map((item) => item.slug)).toEqual([
      "barbell-bench-press",
      "incline-dumbbell-press",
      "dumbbell-bench-press",
      "incline-barbell-bench-press",
      "push-up",
      "machine-chest-press",
      "leg-press",
      "barbell-overhead-press",
      "dumbbell-shoulder-press",
      "close-grip-bench-press",
    ]);
  });
});
