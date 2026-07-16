export const exerciseFamilies = [
  "curl",
  "triceps",
  "press",
  "overhead-press",
  "fly",
  "raise",
  "row",
  "pull-down",
  "squat",
  "lunge",
  "hinge",
  "hip-thrust",
  "carry",
  "core",
  "plank",
  "other",
] as const;

export type ExerciseFamily = (typeof exerciseFamilies)[number];

const familyLabels: Record<ExerciseFamily, string> = {
  curl: "Curl",
  triceps: "Triceps",
  press: "Press",
  "overhead-press": "Overhead Press",
  fly: "Fly",
  raise: "Raise",
  row: "Row",
  "pull-down": "Pull-down",
  squat: "Squat",
  lunge: "Lunge",
  hinge: "Hinge",
  "hip-thrust": "Hip Thrust",
  carry: "Carry",
  core: "Core",
  plank: "Plank",
  other: "Other",
};

export function formatExerciseFamily(family: ExerciseFamily): string {
  return familyLabels[family];
}

export function isExerciseFamily(value: unknown): value is ExerciseFamily {
  return typeof value === "string" && (exerciseFamilies as readonly string[]).includes(value);
}

export function inferExerciseFamily(label: string | null | undefined): ExerciseFamily {
  const value = (label ?? "").toLocaleLowerCase();
  if (/curl/.test(value)) return "curl";
  if (/tricep|skull crusher|pushdown|extension/.test(value)) return "triceps";
  if (/shoulder press|overhead press|military press|arnold press|push press/.test(value)) return "overhead-press";
  if (/bench press|chest press|push-up|pushup/.test(value)) return "press";
  if (/fly|flye|pec deck/.test(value)) return "fly";
  if (/raise/.test(value)) return "raise";
  if (/row/.test(value)) return "row";
  if (/pull.?down|pull.?up|chin.?up/.test(value)) return "pull-down";
  if (/squat/.test(value)) return "squat";
  if (/lunge|split squat|step.?up/.test(value)) return "lunge";
  if (/deadlift|hinge|good morning/.test(value)) return "hinge";
  if (/hip thrust|glute bridge/.test(value)) return "hip-thrust";
  if (/carry|farmer/.test(value)) return "carry";
  if (/plank/.test(value)) return "plank";
  if (/crunch|sit.?up|abdominal|core/.test(value)) return "core";
  return "other";
}
