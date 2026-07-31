import type { AnalysisResult } from "./result-schema";
import type { SetDeclaration } from "./set-declaration";
import { declarationForReanalysis } from "./reanalysis-declaration";

const storedDeclaration: SetDeclaration = {
  exercise: { source: "catalog", catalogExerciseId: 3, label: "Dumbbell Bench Press" },
  amount: { kind: "reps", value: 8, countScope: "total" },
  load: { kind: "known", value: 40, unit: "lb", scope: "per_hand" },
  side: "bilateral",
  styles: ["paused"],
  focusNote: "Check my left shoulder.",
};

function legacyResult(label: string | null, totalReps: number | null): AnalysisResult {
  return {
    recognition: { label },
    setSummary: { totalReps },
  } as AnalysisResult;
}

describe("declarationForReanalysis", () => {
  it("prefers the declaration stored on the session", () => {
    const resultDeclaration = { ...storedDeclaration, focusNote: null };
    const result = { ...legacyResult("Wrong label", 3), setDeclaration: resultDeclaration } as AnalysisResult;

    expect(declarationForReanalysis(result, storedDeclaration)).toBe(storedDeclaration);
  });

  it("uses the declaration in the result when the status payload has none", () => {
    const result = { ...legacyResult("Wrong label", 3), setDeclaration: storedDeclaration } as AnalysisResult;

    expect(declarationForReanalysis(result, null)).toBe(storedDeclaration);
  });

  it("prefills historical exercise and repetition data with unknown load", () => {
    expect(declarationForReanalysis(legacyResult("Flat Dumbbell Bench Press", 3), null)).toEqual({
      exercise: { source: "custom", catalogExerciseId: null, label: "Flat Dumbbell Bench Press" },
      amount: { kind: "reps", value: 3, countScope: "total" },
      load: { kind: "unknown" },
      side: null,
      styles: [],
      focusNote: null,
    });
  });

  it("leaves incomplete historical context blank for user entry", () => {
    expect(declarationForReanalysis(legacyResult(null, null), null)).toBeNull();
  });
});
