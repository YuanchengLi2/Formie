import { z } from "zod";

import { exerciseFamilies, type ExerciseFamily } from "@/features/exercises/exercise-family";

const exerciseFamilySchema = z.enum(exerciseFamilies);

export const progressMetricsSchema = z.object({
  currentStreakDays: z.number().int().nonnegative(),
  averageScore: z.number().int().nullable(),
  bestExercise: z.object({
    family: exerciseFamilySchema,
    label: z.string().min(1),
    averageScore: z.number().int(),
    scoredSessions: z.number().int().positive(),
  }).nullable(),
  biggestImprovement: z.object({
    family: exerciseFamilySchema,
    label: z.string().min(1),
    points: z.number().int().positive(),
    firstScore: z.number(),
    latestScore: z.number(),
  }).nullable(),
});

export type ProgressMetrics = z.infer<typeof progressMetricsSchema>;
export type ProgressMetricKind = "streak" | "average" | "best" | "improvement";

export function progressMetricsValue(metrics: ProgressMetrics | null, kind: ProgressMetricKind): string {
  if (kind === "streak") {
    return metrics && metrics.currentStreakDays > 0
      ? `${metrics.currentStreakDays} ${metrics.currentStreakDays === 1 ? "day" : "days"}`
      : "Start today";
  }
  if (kind === "average") {
    return metrics?.averageScore === null || metrics?.averageScore === undefined
      ? "—"
      : String(metrics.averageScore);
  }
  if (kind === "best") {
    return metrics?.bestExercise
      ? `${metrics.bestExercise.label} · ${metrics.bestExercise.averageScore} avg`
      : "Not yet";
  }
  return metrics?.biggestImprovement
    ? `${metrics.biggestImprovement.label} · +${metrics.biggestImprovement.points}`
    : "Need 2 scores";
}

export const progressMetricDefinitions: readonly {
  kind: ProgressMetricKind;
  label: string;
}[] = [
  { kind: "streak", label: "Current streak" },
  { kind: "average", label: "Average score" },
  { kind: "best", label: "Best exercise" },
  { kind: "improvement", label: "Biggest improvement" },
];

export type { ExerciseFamily };
