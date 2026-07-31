import type { ExerciseGuide } from "@/features/analysis/api";

const pendingGuides = new Map<string, Promise<ExerciseGuide>>();

export function loadExerciseGuideOnce(
  key: string,
  load: () => Promise<ExerciseGuide>,
  force = false,
): Promise<ExerciseGuide> {
  if (force) pendingGuides.delete(key);
  const pending = pendingGuides.get(key);
  if (pending) return pending;

  const request = load().finally(() => {
    if (pendingGuides.get(key) === request) pendingGuides.delete(key);
  });
  pendingGuides.set(key, request);
  return request;
}
