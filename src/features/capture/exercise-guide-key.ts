import type { CaptureExerciseChoice } from "./types";

export function getCaptureExerciseGuideKey(choice: CaptureExerciseChoice): string | null {
  if (choice.kind === "selected") return `catalog:${choice.catalogExerciseId}`;
  if (choice.kind === "custom") {
    return `custom:${choice.canonicalName.trim().replace(/\s+/g, " ").toLocaleLowerCase()}`;
  }
  return null;
}
