import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";

export type MuscleModelHighlightKind = "base" | "target" | "secondary" | "issue";

export type MuscleModelPart =
  | "left-deltoid" | "right-deltoid"
  | "left-chest" | "right-chest"
  | "left-upper-back" | "right-upper-back"
  | "left-lat" | "right-lat"
  | "left-biceps" | "right-biceps"
  | "left-triceps" | "right-triceps"
  | "left-elbow" | "right-elbow"
  | "left-forearm" | "right-forearm"
  | "left-wrist" | "right-wrist"
  | "left-abs" | "right-abs"
  | "left-oblique" | "right-oblique"
  | "left-lower-back" | "right-lower-back"
  | "left-hip" | "right-hip"
  | "left-glute" | "right-glute"
  | "left-quad" | "right-quad"
  | "left-hamstring" | "right-hamstring"
  | "left-adductor" | "right-adductor"
  | "left-knee" | "right-knee"
  | "left-calf" | "right-calf"
  | "left-ankle" | "right-ankle"
  | "base";

export type MuscleModelSelection = {
  targetRegions: readonly MuscleRegion[];
  secondaryRegions: readonly MuscleRegion[];
  issueRegions: readonly AnatomyRegion[];
};

type Region = MuscleRegion | AnatomyRegion;

const sides = <T extends string>(name: T) => [`left-${name}`, `right-${name}`] as const;

const REGION_PARTS: Record<Region, readonly MuscleModelPart[]> = {
  chest: sides("chest"),
  front_shoulders: sides("deltoid"),
  rear_shoulders: sides("deltoid"),
  shoulders: sides("deltoid"),
  upper_back: sides("upper-back"),
  lats: sides("lat"),
  biceps: sides("biceps"),
  triceps: sides("triceps"),
  upper_arms: [...sides("biceps"), ...sides("triceps")],
  elbows: sides("elbow"),
  forearms: sides("forearm"),
  wrists: sides("wrist"),
  abs: sides("abs"),
  obliques: sides("oblique"),
  torso: [...sides("chest"), ...sides("abs"), ...sides("oblique"), ...sides("upper-back"), ...sides("lower-back")],
  lower_back: sides("lower-back"),
  hips: sides("hip"),
  glutes: sides("glute"),
  quads: sides("quad"),
  hamstrings: sides("hamstring"),
  adductors: sides("adductor"),
  knees: sides("knee"),
  calves: sides("calf"),
  ankles: sides("ankle"),
};

function containsPart(regions: readonly Region[], part: MuscleModelPart) {
  return regions.some((region) => REGION_PARTS[region].includes(part));
}

export function muscleModelHighlightForPart(part: MuscleModelPart, selection: MuscleModelSelection): MuscleModelHighlightKind {
  if (containsPart(selection.issueRegions, part)) return "issue";
  if (containsPart(selection.secondaryRegions, part)) return "secondary";
  if (containsPart(selection.targetRegions, part)) return "target";
  return "base";
}

/**
 * Classifies a vertex on the normalized, Y-up body mesh. X spans left/right,
 * Y runs from feet (-0.5) to head (0.5), and positive Z is the front surface.
 */
export function muscleModelPartAtPosition(x: number, y: number, z: number): MuscleModelPart {
  const side = x < 0 ? "left" : "right";
  const ax = Math.abs(x);
  const front = z >= 0;

  if (y < -0.455) return ax < 0.2 ? `${side}-ankle` : "base";
  if (y < -0.335) return `${side}-calf`;
  if (y < -0.285) return `${side}-knee`;
  if (y < -0.12) {
    if (front && ax < 0.12) return `${side}-adductor`;
    return front ? `${side}-quad` : `${side}-hamstring`;
  }
  if (y < -0.035) return front ? `${side}-hip` : `${side}-glute`;

  if (ax > 0.34) {
    if (y < 0.08) return `${side}-wrist`;
    if (y < 0.19) return `${side}-forearm`;
    if (y < 0.225) return `${side}-elbow`;
    if (y < 0.34) return front ? `${side}-biceps` : `${side}-triceps`;
  }

  if (y < 0.115) {
    if (ax < 0.13) return front ? `${side}-abs` : `${side}-lower-back`;
    return front ? `${side}-oblique` : `${side}-lower-back`;
  }
  if (y < 0.265) {
    if (ax > 0.25) return `${side}-deltoid`;
    if (front) return `${side}-chest`;
    return ax > 0.13 ? `${side}-lat` : `${side}-upper-back`;
  }
  if (y < 0.33 && ax > 0.2) return `${side}-deltoid`;
  return "base";
}
