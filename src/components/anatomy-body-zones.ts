import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";

export type AnatomyBodyFace = "front" | "back";
export type AnatomyBodyZone = {
  id: string;
  face: AnatomyBodyFace;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: number;
};

type Region = AnatomyRegion | MuscleRegion;

const zone = (
  id: string,
  face: AnatomyBodyFace,
  x: number,
  y: number,
  width: number,
  height: number,
  rotate = 0,
): AnatomyBodyZone => ({ id, face, x, y, width, height, rotate });

const ZONES: Record<Region, AnatomyBodyZone[]> = {
  chest: [
    zone("front-left-pec", "front", 0.43, 0.205, 0.14, 0.08, -5),
    zone("front-right-pec", "front", 0.56, 0.205, 0.14, 0.08, 5),
  ],
  front_shoulders: [
    zone("front-left-shoulder", "front", 0.35, 0.185, 0.11, 0.085, 18),
    zone("front-right-shoulder", "front", 0.68, 0.185, 0.11, 0.085, -18),
  ],
  rear_shoulders: [
    zone("back-left-rear-shoulder", "back", 0.2, 0.19, 0.12, 0.085, 18),
    zone("back-right-rear-shoulder", "back", 0.55, 0.19, 0.12, 0.085, -18),
  ],
  shoulders: [
    zone("front-left-shoulder-joint", "front", 0.35, 0.185, 0.12, 0.09, 18),
    zone("front-right-shoulder-joint", "front", 0.68, 0.185, 0.12, 0.09, -18),
    zone("back-left-shoulder-joint", "back", 0.2, 0.185, 0.13, 0.09, 18),
    zone("back-right-shoulder-joint", "back", 0.55, 0.185, 0.13, 0.09, -18),
  ],
  upper_back: [
    zone("back-upper-center", "back", 0.335, 0.17, 0.19, 0.11),
    zone("back-left-scapular", "back", 0.27, 0.235, 0.14, 0.12, 8),
    zone("back-right-scapular", "back", 0.45, 0.235, 0.14, 0.12, -8),
  ],
  lats: [
    zone("back-left-lat", "back", 0.265, 0.29, 0.14, 0.16, 8),
    zone("back-right-lat", "back", 0.455, 0.29, 0.14, 0.16, -8),
  ],
  biceps: [
    zone("front-left-biceps", "front", 0.36, 0.275, 0.08, 0.105, 7),
    zone("front-right-biceps", "front", 0.69, 0.275, 0.08, 0.105, -7),
  ],
  triceps: [
    zone("back-left-triceps", "back", 0.195, 0.275, 0.09, 0.12, 8),
    zone("back-right-triceps", "back", 0.595, 0.275, 0.09, 0.12, -8),
  ],
  upper_arms: [
    zone("front-left-upper-arm", "front", 0.35, 0.27, 0.1, 0.13, 8),
    zone("front-right-upper-arm", "front", 0.68, 0.27, 0.1, 0.13, -8),
    zone("back-left-upper-arm", "back", 0.19, 0.27, 0.1, 0.13, 8),
    zone("back-right-upper-arm", "back", 0.59, 0.27, 0.1, 0.13, -8),
  ],
  elbows: [
    zone("front-left-elbow", "front", 0.305, 0.385, 0.08, 0.055),
    zone("front-right-elbow", "front", 0.765, 0.385, 0.08, 0.055),
    zone("back-left-elbow", "back", 0.15, 0.385, 0.08, 0.055),
    zone("back-right-elbow", "back", 0.655, 0.385, 0.08, 0.055),
  ],
  forearms: [
    zone("front-left-forearm", "front", 0.25, 0.4, 0.1, 0.15, 12),
    zone("front-right-forearm", "front", 0.77, 0.4, 0.1, 0.15, -12),
    zone("back-left-forearm", "back", 0.105, 0.4, 0.1, 0.15, 12),
    zone("back-right-forearm", "back", 0.69, 0.4, 0.1, 0.15, -12),
  ],
  wrists: [
    zone("front-left-wrist", "front", 0.21, 0.53, 0.075, 0.045),
    zone("front-right-wrist", "front", 0.84, 0.53, 0.075, 0.045),
    zone("back-left-wrist", "back", 0.09, 0.53, 0.075, 0.045),
    zone("back-right-wrist", "back", 0.72, 0.53, 0.075, 0.045),
  ],
  abs: [
    zone("front-abdominals", "front", 0.49, 0.285, 0.15, 0.19),
  ],
  obliques: [
    zone("front-left-oblique", "front", 0.415, 0.305, 0.1, 0.17, 7),
    zone("front-right-oblique", "front", 0.63, 0.305, 0.1, 0.17, -7),
  ],
  torso: [
    zone("front-torso", "front", 0.41, 0.2, 0.32, 0.29),
    zone("back-torso", "back", 0.26, 0.19, 0.34, 0.3),
  ],
  lower_back: [
    zone("back-lower-back", "back", 0.325, 0.355, 0.21, 0.13),
  ],
  hips: [
    zone("front-left-hip", "front", 0.43, 0.47, 0.1, 0.085, 12),
    zone("front-right-hip", "front", 0.59, 0.47, 0.1, 0.085, -12),
    zone("back-left-hip", "back", 0.285, 0.47, 0.13, 0.085, 12),
    zone("back-right-hip", "back", 0.445, 0.47, 0.13, 0.085, -12),
  ],
  glutes: [
    zone("back-left-glute", "back", 0.29, 0.47, 0.14, 0.13, 8),
    zone("back-right-glute", "back", 0.43, 0.47, 0.14, 0.13, -8),
  ],
  quads: [
    zone("front-left-quad", "front", 0.44, 0.55, 0.12, 0.2, 3),
    zone("front-right-quad", "front", 0.58, 0.55, 0.12, 0.2, -3),
  ],
  hamstrings: [
    zone("back-left-hamstring", "back", 0.31, 0.58, 0.12, 0.18, 3),
    zone("back-right-hamstring", "back", 0.44, 0.58, 0.12, 0.18, -3),
  ],
  adductors: [
    zone("front-left-adductor", "front", 0.5, 0.55, 0.075, 0.18, 4),
    zone("front-right-adductor", "front", 0.555, 0.55, 0.075, 0.18, -4),
  ],
  knees: [
    zone("front-left-knee", "front", 0.435, 0.735, 0.09, 0.065),
    zone("front-right-knee", "front", 0.595, 0.735, 0.09, 0.065),
    zone("back-left-knee", "back", 0.335, 0.735, 0.09, 0.065),
    zone("back-right-knee", "back", 0.455, 0.735, 0.09, 0.065),
  ],
  calves: [
    zone("back-left-calf", "back", 0.325, 0.77, 0.105, 0.17),
    zone("back-right-calf", "back", 0.445, 0.77, 0.105, 0.17),
  ],
  ankles: [
    zone("front-left-ankle", "front", 0.44, 0.915, 0.08, 0.045),
    zone("front-right-ankle", "front", 0.6, 0.915, 0.08, 0.045),
    zone("back-left-ankle", "back", 0.34, 0.915, 0.08, 0.045),
    zone("back-right-ankle", "back", 0.46, 0.915, 0.08, 0.045),
  ],
};

export function anatomyBodyZonesForRegion(region: Region): AnatomyBodyZone[] {
  return ZONES[region] ?? [];
}
