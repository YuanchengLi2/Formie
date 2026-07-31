import {
  buildVisibilityRequirements,
  resolveVisibilityRequirements,
} from "./visibility-requirements";

describe("recording preflight visibility requirements", () => {
  it("builds a minimal catalog checklist from the trusted family and mechanics", () => {
    expect(buildVisibilityRequirements({
      source: "catalog",
      exerciseName: "One-Arm Dumbbell Row",
      family: "row",
      mechanics: {
        equipmentClass: "dumbbell",
        support: "bench-supported",
        laterality: "unilateral",
        trajectory: "free-path",
      },
    })).toEqual({
      source: "catalog",
      exerciseName: "One-Arm Dumbbell Row",
      bodyRegions: [
        "working shoulder, elbow, and hand relationship",
        "torso and pelvis relationship",
      ],
      equipment: ["working dumbbell and its complete path"],
      support: ["body contact with the supporting bench"],
      movementPhases: ["start, working range, end, and return of one complete repetition"],
    });
  });

  it("does not make optional head, foot, or ankle visibility mandatory for a squat", () => {
    const requirements = buildVisibilityRequirements({
      source: "catalog",
      exerciseName: "Bodyweight Squat",
      family: "squat",
      mechanics: { equipmentClass: "bodyweight", support: "unsupported" },
    });

    expect(requirements.bodyRegions).toEqual([
      "torso and pelvis relationship",
      "hips and knees through the full depth and return",
    ]);
    expect(requirements.equipment).toEqual([]);
    expect(requirements.support).toEqual([]);
    expect(JSON.stringify(requirements)).not.toMatch(/head|feet|ankle/i);
  });

  it("uses the production knee-flexion family for leg curls instead of arm-curl regions", () => {
    const requirements = buildVisibilityRequirements({
      source: "catalog",
      exerciseName: "Seated Leg Curl",
      family: "knee-flexion",
      mechanics: {
        equipmentClass: "selectorized-machine",
        support: "seat-supported",
      },
    });

    expect(requirements.bodyRegions).toEqual([
      "pelvis and thigh relationship",
      "knee and lower leg through the full curl and return",
    ]);
    expect(requirements.support).toEqual(["body contact with the machine seat or support pads"]);
    expect(JSON.stringify(requirements.bodyRegions)).not.toMatch(/shoulder|elbow|hand/i);
  });

  it("keeps squat feet optional even when the catalog mechanics say feet-supported", () => {
    const requirements = buildVisibilityRequirements({
      source: "catalog",
      exerciseName: "Bodyweight Squat",
      family: "squat",
      mechanics: {
        equipmentClass: "bodyweight",
        support: "feet-supported",
      },
    });

    expect(requirements.support).toEqual([]);
  });

  it("requires the foot-to-floor relationship when it is exercise-critical for calf work", () => {
    const requirements = buildVisibilityRequirements({
      source: "catalog",
      exerciseName: "Standing Calf Raise",
      family: "calf",
      mechanics: {
        equipmentClass: "bodyweight",
        support: "feet-supported",
      },
    });

    expect(requirements.bodyRegions).toContain("lower leg, ankle, heel, and forefoot relationship");
    expect(requirements.support).toEqual(["forefoot contact with the support surface"]);
  });

  it("resolves catalog metadata on the server instead of trusting client mechanics", async () => {
    const loadCatalogExercise = jest.fn(async () => ({
      id: 88,
      name: "One-Arm Dumbbell Row",
      family: "row",
      mechanics: {
        equipmentClass: "dumbbell",
        support: "bench-supported",
        laterality: "unilateral",
      },
    }));

    const result = await resolveVisibilityRequirements({
      catalogExerciseId: 88,
      exerciseName: "Client supplied label",
      loadCatalogExercise,
    });

    expect(loadCatalogExercise).toHaveBeenCalledWith(88);
    expect(result.source).toBe("catalog");
    expect(result.exerciseName).toBe("One-Arm Dumbbell Row");
    expect(result.equipment).toContain("working dumbbell and its complete path");
  });

  it("uses a conservative inferred checklist for custom exercises", async () => {
    const requirements = await resolveVisibilityRequirements({
      catalogExerciseId: null,
      exerciseName: "Jefferson Curl",
      loadCatalogExercise: jest.fn(),
    });

    expect(requirements).toMatchObject({
      source: "inferred",
      exerciseName: "Jefferson Curl",
      bodyRegions: [
        "shoulders and torso relationship",
        "pelvis, hips, and knees relationship",
      ],
      equipment: ["any exercise implement and its contact or complete path when used"],
      support: ["any bench, machine, floor, or anchor contact needed for the exercise"],
      movementPhases: ["start, working range, end, and return of one complete repetition"],
    });
  });
});
