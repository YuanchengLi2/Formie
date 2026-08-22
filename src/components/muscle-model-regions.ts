import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";

export type MuscleModelHighlightKind = "base" | "target" | "secondary" | "issue";

export type AnatomyMuscleTag =
  | "abs"
  | "adductors"
  | "biceps"
  | "calves"
  | "chest"
  | "deltoids"
  | "forearm"
  | "glutes"
  | "hamstrings"
  | "lats"
  | "lower_back"
  | "obliques"
  | "quads"
  | "traps"
  | "triceps";

export type MuscleModelSelection = {
  targetRegions: readonly MuscleRegion[];
  secondaryRegions: readonly MuscleRegion[];
  issueRegions: readonly AnatomyRegion[];
};

type Region = MuscleRegion | AnatomyRegion;

const ANATOMY_MUSCLE_TAGS: readonly AnatomyMuscleTag[] = [
  "abs",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "deltoids",
  "forearm",
  "glutes",
  "hamstrings",
  "lats",
  "lower_back",
  "obliques",
  "quads",
  "traps",
  "triceps",
];

const REGION_MUSCLES: Record<Region, readonly AnatomyMuscleTag[]> = {
  chest: ["chest"],
  front_shoulders: ["deltoids"],
  rear_shoulders: ["deltoids", "traps"],
  shoulders: ["deltoids", "traps"],
  upper_back: ["traps"],
  lats: ["lats"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  upper_arms: ["biceps", "triceps"],
  elbows: ["biceps", "triceps", "forearm"],
  forearms: ["forearm"],
  wrists: ["forearm"],
  abs: ["abs"],
  obliques: ["obliques"],
  torso: ["chest", "abs", "obliques", "traps", "lats", "lower_back"],
  lower_back: ["lower_back"],
  hips: ["glutes", "adductors"],
  glutes: ["glutes"],
  quads: ["quads"],
  hamstrings: ["hamstrings"],
  adductors: ["adductors"],
  knees: ["quads", "hamstrings", "calves"],
  calves: ["calves"],
  ankles: ["calves"],
};

export function isAnatomyMuscleTag(value: unknown): value is AnatomyMuscleTag {
  return typeof value === "string" && ANATOMY_MUSCLE_TAGS.includes(value as AnatomyMuscleTag);
}

function containsMuscle(regions: readonly Region[], muscle: AnatomyMuscleTag) {
  return regions.some((region) => REGION_MUSCLES[region].includes(muscle));
}

export function muscleModelHighlightForTag(muscle: AnatomyMuscleTag, selection: MuscleModelSelection): MuscleModelHighlightKind {
  if (containsMuscle(selection.issueRegions, muscle)) return "issue";
  if (containsMuscle(selection.secondaryRegions, muscle)) return "secondary";
  if (containsMuscle(selection.targetRegions, muscle)) return "target";
  return "base";
}
