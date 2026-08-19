import { parseSetDeclaration } from "./set-declaration";

const validDeclaration = {
  exercise: {
    source: "catalog",
    catalogExerciseId: 2,
    label: "Flat Dumbbell Bench Press",
  },
  amount: {
    kind: "reps",
    value: 8,
    countScope: "total",
  },
  load: {
    kind: "known",
    value: 45,
    unit: "lb",
    scope: "per_hand",
  },
  side: "bilateral",
  styles: ["paused"],
  focusNote: "Check whether my wrists stay stacked.",
};

describe("set declaration", () => {
  it("accepts a complete catalog declaration and normalizes user text", () => {
    expect(parseSetDeclaration({
      ...validDeclaration,
      exercise: { ...validDeclaration.exercise, label: "  Flat Dumbbell Bench Press  " },
      focusNote: "  Check whether my wrists stay stacked.  ",
    })).toEqual(validDeclaration);
  });

  it("accepts custom exercises and an honest unknown load", () => {
    expect(parseSetDeclaration({
      exercise: { source: "custom", catalogExerciseId: null, label: "Meadows row" },
      amount: { kind: "reps", value: 10, countScope: "per_side" },
      load: { kind: "unknown" },
      side: "left",
      styles: [],
      focusNote: null,
    })).toMatchObject({
      exercise: { source: "custom", catalogExerciseId: null, label: "Meadows row" },
      load: { kind: "unknown" },
    });
  });

  it("accepts timed bodyweight work without a rep-count scope", () => {
    expect(parseSetDeclaration({
      exercise: { source: "catalog", catalogExerciseId: 600, label: "Plank" },
      amount: { kind: "seconds", value: 45, countScope: null },
      load: { kind: "bodyweight" },
      side: null,
      styles: ["to_failure"],
      focusNote: null,
    }).amount).toEqual({ kind: "seconds", value: 45, countScope: null });
  });

  it("caps focus notes at the 120-character reference limit", () => {
    const note = "x".repeat(120);
    expect(parseSetDeclaration({ ...validDeclaration, focusNote: note }).focusNote).toBe(note);
    expect(() => parseSetDeclaration({ ...validDeclaration, focusNote: `${note}x` })).toThrow(/120|too big/i);
  });

  it.each([
    [{ ...validDeclaration, exercise: { source: "catalog", catalogExerciseId: null, label: "Bench press" } }, /catalog exercise/i],
    [{ ...validDeclaration, exercise: { source: "custom", catalogExerciseId: 2, label: "Custom press" } }, /custom exercise/i],
    [{ ...validDeclaration, amount: { kind: "reps", value: 0, countScope: "total" } }, /amount/i],
    [{ ...validDeclaration, amount: { kind: "reps", value: 8, countScope: null } }, /total or per-side/i],
    [{ ...validDeclaration, amount: { kind: "seconds", value: 20, countScope: "total" } }, /timed amount/i],
    [{ ...validDeclaration, load: { kind: "known", value: 0, unit: "lb", scope: "total" } }, /load/i],
    [{ ...validDeclaration, styles: ["paused", "paused"] }, /style/i],
  ])("rejects invalid declaration %#", (value, expected) => {
    expect(() => parseSetDeclaration(value)).toThrow(expected);
  });
});
