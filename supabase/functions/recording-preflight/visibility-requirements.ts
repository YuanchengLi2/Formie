export type VisibilityRequirementSource = "catalog" | "inferred";

export type VisibilityRequirements = {
  source: VisibilityRequirementSource;
  exerciseName: string | null;
  bodyRegions: string[];
  equipment: string[];
  support: string[];
  movementPhases: string[];
};

export type CatalogExerciseVisibilityMetadata = {
  id: number;
  name: string;
  family: string;
  mechanics: Record<string, unknown> | null;
};

const FAMILY_BODY_REGIONS: Record<string, string[]> = {
  curl: [
    "working shoulder, elbow, and hand relationship",
    "torso and pelvis relationship",
  ],
  triceps: [
    "working shoulder, elbow, and hand relationship",
    "torso and pelvis relationship",
  ],
  press: [
    "shoulders, elbows, and hands through the press path",
    "torso and pelvis relationship",
  ],
  "overhead-press": [
    "shoulders, elbows, and hands through the overhead path",
    "torso and pelvis relationship",
  ],
  fly: [
    "shoulders, elbows, and hands through the fly path",
    "torso and pelvis relationship",
  ],
  raise: [
    "shoulders, elbows, and hands through the raise path",
    "torso and pelvis relationship",
  ],
  row: [
    "working shoulder, elbow, and hand relationship",
    "torso and pelvis relationship",
  ],
  "pull-down": [
    "shoulders, elbows, and hands through the pull path",
    "torso and pelvis relationship",
  ],
  squat: [
    "torso and pelvis relationship",
    "hips and knees through the full depth and return",
  ],
  lunge: [
    "torso and pelvis relationship",
    "hips and both knees through the full descent and return",
  ],
  hinge: [
    "shoulders and torso relationship",
    "pelvis, hips, and knees relationship",
  ],
  "hip-extension": [
    "torso and pelvis relationship",
    "hips and knees through the full extension and return",
  ],
  "hip-thrust": [
    "torso and pelvis relationship",
    "hips and knees through the full extension and return",
  ],
  "knee-extension": [
    "pelvis and thigh relationship",
    "knee and lower leg through the full extension and return",
  ],
  "knee-flexion": [
    "pelvis and thigh relationship",
    "knee and lower leg through the full curl and return",
  ],
  calf: [
    "knee and lower leg relationship",
    "lower leg, ankle, heel, and forefoot relationship",
  ],
  carry: [
    "shoulders, torso, and pelvis relationship",
    "hips and knees through the visible travel path",
  ],
  core: [
    "shoulders, torso, and pelvis relationship",
    "hips and knees when they move or anchor the exercise",
  ],
  plank: [
    "shoulders, torso, pelvis, and hips relationship",
    "all body contact points supporting the hold",
  ],
  other: [
    "primary moving joints and adjoining body segments",
    "torso and pelvis when they affect the exercise",
  ],
};

function normalizedMechanic(mechanics: Record<string, unknown> | null, key: string): string | null {
  const value = mechanics?.[key];
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function humanize(value: string): string {
  return value.replaceAll("-", " ");
}

function inferFamily(exerciseName: string | null): string {
  const value = (exerciseName ?? "").toLowerCase();
  if (/jefferson curl/.test(value)) return "hinge";
  if (/leg curl|hamstring curl/.test(value)) return "knee-flexion";
  if (/leg extension|knee extension/.test(value)) return "knee-extension";
  if (/calf|heel raise/.test(value)) return "calf";
  if (/hip thrust|glute bridge|hip extension|back extension/.test(value)) return "hip-extension";
  if (/curl/.test(value)) return "curl";
  if (/tricep|skull crusher|pushdown/.test(value)) return "triceps";
  if (/shoulder press|overhead press|military press|arnold press|push press/.test(value)) return "overhead-press";
  if (/bench press|chest press|push-up|pushup/.test(value)) return "press";
  if (/fly|flye|pec deck/.test(value)) return "fly";
  if (/raise/.test(value)) return "raise";
  if (/row/.test(value)) return "row";
  if (/pull.?down|pull.?up|chin.?up/.test(value)) return "pull-down";
  if (/squat/.test(value)) return "squat";
  if (/lunge|split squat|step.?up/.test(value)) return "lunge";
  if (/deadlift|hinge|good morning/.test(value)) return "hinge";
  if (/carry|farmer/.test(value)) return "carry";
  if (/plank/.test(value)) return "plank";
  if (/crunch|sit.?up|abdominal|core/.test(value)) return "core";
  return "other";
}

function equipmentRequirements(mechanics: Record<string, unknown> | null): string[] {
  const equipmentClass = normalizedMechanic(mechanics, "equipmentClass");
  if (!equipmentClass || equipmentClass === "bodyweight" || equipmentClass === "none") return [];
  const laterality = normalizedMechanic(mechanics, "laterality");
  if (equipmentClass === "dumbbell") {
    return [laterality === "unilateral"
      ? "working dumbbell and its complete path"
      : "dumbbells and their complete paths"];
  }
  if (equipmentClass === "barbell") return ["barbell and its complete path"];
  if (equipmentClass === "kettlebell") return ["kettlebell and its complete path"];
  if (equipmentClass === "cable") return ["working cable handle and cable line through the complete path"];
  if (equipmentClass.includes("machine") || equipmentClass === "smith") {
    return ["working machine handles or pads and their complete path"];
  }
  if (equipmentClass.includes("band")) return ["working band and its anchor or contact point"];
  return [`working ${humanize(equipmentClass)} and its complete path`];
}

function supportRequirements(
  mechanics: Record<string, unknown> | null,
  family: string,
): string[] {
  const support = normalizedMechanic(mechanics, "support");
  if (
    !support
    || support === "unsupported"
    || support === "unsupported-hinge"
    || support === "standing"
    || support === "walking-base"
    || support === "standing-or-kneeling-base"
  ) return [];
  if (support === "feet-supported") {
    return family === "calf" ? ["forefoot contact with the support surface"] : [];
  }
  if (support === "bench-supported") return ["body contact with the supporting bench"];
  if (support === "machine-supported" || support === "seat-supported") {
    return ["body contact with the machine seat or support pads"];
  }
  if (support === "hands-and-feet") return ["hand and foot contact with the support surface"];
  if (support === "hands-supported") return ["hand contact with the support surface"];
  if (support === "floor-supported" || support === "bodyweight-support") {
    return ["exercise-critical body contact with the floor or support surface"];
  }
  if (support === "overhead-hang") return ["hand contact with the overhead support"];
  if (support === "sled-contact") return ["body and hand contact with the sled"];
  if (support === "machine-or-floor-supported") {
    return ["exercise-critical body contact with the machine or floor"];
  }
  if (support.includes("pad-supported")) {
    return [`body contact with the ${humanize(support.replace("-supported", ""))}`];
  }
  if (support === "chest-supported") return ["chest contact with the support"];
  if (support === "prone-supported") return ["torso contact with the prone support"];
  if (support === "upper-back-supported") return ["upper-back contact with the support"];
  if (support === "box-supported") return ["body contact with the supporting box"];
  return [`body contact with the ${humanize(support)} support`];
}

export function buildVisibilityRequirements(input: {
  source: VisibilityRequirementSource;
  exerciseName: string | null;
  family: string | null;
  mechanics: Record<string, unknown> | null;
}): VisibilityRequirements {
  const family = FAMILY_BODY_REGIONS[input.family ?? ""]
    ? input.family!
    : inferFamily(input.exerciseName);
  const equipment = input.source === "inferred"
    ? ["any exercise implement and its contact or complete path when used"]
    : equipmentRequirements(input.mechanics);
  const support = input.source === "inferred"
    ? ["any bench, machine, floor, or anchor contact needed for the exercise"]
    : supportRequirements(input.mechanics, family);
  return {
    source: input.source,
    exerciseName: input.exerciseName,
    bodyRegions: [...FAMILY_BODY_REGIONS[family]],
    equipment,
    support,
    movementPhases: [
      family === "plank"
        ? "setup and the entire sustained hold"
        : "start, working range, end, and return of one complete repetition",
    ],
  };
}

export function flattenVisibilityRequirements(requirements: VisibilityRequirements): string[] {
  return [
    ...requirements.bodyRegions,
    ...requirements.equipment,
    ...requirements.support,
    ...requirements.movementPhases,
  ];
}

export function flattenBlockingVisibilityRequirements(
  requirements: VisibilityRequirements,
): string[] {
  return [
    ...requirements.bodyRegions,
    ...requirements.movementPhases,
  ];
}

export async function resolveVisibilityRequirements(input: {
  catalogExerciseId: number | null;
  exerciseName: string | null;
  loadCatalogExercise: (catalogExerciseId: number) => Promise<CatalogExerciseVisibilityMetadata | null>;
}): Promise<VisibilityRequirements> {
  if (input.catalogExerciseId !== null) {
    const catalogExercise = await input.loadCatalogExercise(input.catalogExerciseId);
    if (catalogExercise) {
      return buildVisibilityRequirements({
        source: "catalog",
        exerciseName: catalogExercise.name,
        family: catalogExercise.family,
        mechanics: catalogExercise.mechanics,
      });
    }
  }
  return buildVisibilityRequirements({
    source: "inferred",
    exerciseName: input.exerciseName,
    family: null,
    mechanics: null,
  });
}
