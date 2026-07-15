import { EXERCISES } from "./catalog";
import type { Exercise, ExerciseCategory } from "./types";

export function searchExercises(query: string, category?: ExerciseCategory): Exercise[] {
  const normalized = query.trim().toLocaleLowerCase();

  return EXERCISES.filter((exercise) => {
    if (category && exercise.category !== category) {
      return false;
    }

    if (!normalized) {
      return true;
    }

    const searchable = [exercise.name, exercise.slug, ...exercise.aliases]
      .join(" ")
      .toLocaleLowerCase();

    return searchable.includes(normalized);
  });
}
