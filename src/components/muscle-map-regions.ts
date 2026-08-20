import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";

export type MuscleMapFace = "front" | "back";
export type MuscleMapHighlightKind = "target" | "secondary" | "issue";
export type MuscleMapSlug =
  | "abs"
  | "adductors"
  | "ankles"
  | "biceps"
  | "calves"
  | "chest"
  | "deltoids"
  | "feet"
  | "forearm"
  | "gluteal"
  | "hamstring"
  | "hands"
  | "knees"
  | "lower-back"
  | "obliques"
  | "quadriceps"
  | "tibialis"
  | "trapezius"
  | "triceps"
  | "upper-back";

type Region = AnatomyRegion | MuscleRegion;
type FacePaths = Partial<Record<MuscleMapFace, readonly MuscleMapSlug[]>>;

const REGION_PATHS: Record<Region, FacePaths> = {
  chest: { front: ["chest"] },
  front_shoulders: { front: ["deltoids"] },
  rear_shoulders: { back: ["deltoids"] },
  shoulders: { front: ["deltoids"], back: ["deltoids"] },
  upper_back: { back: ["upper-back", "trapezius"] },
  lats: { back: ["upper-back"] },
  biceps: { front: ["biceps"] },
  triceps: { front: ["triceps"], back: ["triceps"] },
  upper_arms: { front: ["biceps", "triceps"], back: ["triceps"] },
  elbows: { front: ["triceps"], back: ["triceps"] },
  forearms: { front: ["forearm"], back: ["forearm"] },
  wrists: { front: ["hands"], back: ["hands"] },
  abs: { front: ["abs"] },
  obliques: { front: ["obliques"] },
  torso: { front: ["chest", "abs", "obliques"], back: ["upper-back", "lower-back"] },
  lower_back: { back: ["lower-back"] },
  hips: { front: ["adductors"], back: ["gluteal"] },
  glutes: { back: ["gluteal"] },
  quads: { front: ["quadriceps"] },
  hamstrings: { back: ["hamstring"] },
  adductors: { front: ["adductors"], back: ["adductors"] },
  knees: { front: ["knees"] },
  calves: { front: ["calves", "tibialis"], back: ["calves"] },
  ankles: { front: ["ankles"], back: ["ankles"] },
};

const KIND_PRIORITY: Record<MuscleMapHighlightKind, number> = { target: 1, secondary: 2, issue: 3 };

function addRegions(
  highlights: Map<MuscleMapSlug, MuscleMapHighlightKind>,
  face: MuscleMapFace,
  regions: readonly Region[],
  kind: MuscleMapHighlightKind,
) {
  regions.forEach((region) => {
    REGION_PATHS[region][face]?.forEach((slug) => {
      const current = highlights.get(slug);
      if (!current || KIND_PRIORITY[kind] > KIND_PRIORITY[current]) highlights.set(slug, kind);
    });
  });
}

export function muscleMapHighlightsForFace(
  face: MuscleMapFace,
  targetRegions: readonly MuscleRegion[],
  secondaryRegions: readonly MuscleRegion[],
  issueRegions: readonly AnatomyRegion[],
): { slug: MuscleMapSlug; kind: MuscleMapHighlightKind }[] {
  const highlights = new Map<MuscleMapSlug, MuscleMapHighlightKind>();
  addRegions(highlights, face, targetRegions, "target");
  addRegions(highlights, face, secondaryRegions, "secondary");
  addRegions(highlights, face, issueRegions, "issue");
  return Array.from(highlights, ([slug, kind]) => ({ slug, kind }));
}

export function preferredMuscleMapFace(
  targetRegions: readonly MuscleRegion[],
  secondaryRegions: readonly MuscleRegion[],
  issueRegions: readonly AnatomyRegion[],
): MuscleMapFace {
  const front = muscleMapHighlightsForFace("front", targetRegions, secondaryRegions, issueRegions).length;
  const back = muscleMapHighlightsForFace("back", targetRegions, secondaryRegions, issueRegions).length;
  return back > front ? "back" : "front";
}
