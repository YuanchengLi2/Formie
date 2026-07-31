import type { AnalysisResult } from "./result-schema";
import type { SetDeclaration } from "./set-declaration";

export function declarationForReanalysis(
  result: AnalysisResult,
  storedDeclaration: SetDeclaration | null | undefined,
): SetDeclaration | null {
  if (storedDeclaration) return storedDeclaration;
  if (result.setDeclaration) return result.setDeclaration;

  const label = result.recognition.label?.trim();
  const totalReps = result.setSummary?.totalReps;
  if (!label || !Number.isInteger(totalReps) || !totalReps || totalReps < 1) return null;

  return {
    exercise: { source: "custom", catalogExerciseId: null, label },
    amount: { kind: "reps", value: totalReps, countScope: "total" },
    load: { kind: "unknown" },
    side: null,
    styles: [],
    focusNote: null,
  };
}
