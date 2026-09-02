import { exerciseGuideHandler, type ExerciseGuideDependencies } from "./handler";

const generatedGuide = {
  family: "row",
  setup: ["Brace one hand on a stable bench."],
  execution: ["Drive the working elbow toward your hip."],
  safety: ["Keep the supporting surface from sliding."],
  cameraPlacement: ["Place the camera far enough away to keep the bench and full body visible."],
};

function request(catalogExerciseId: unknown = 88) {
  return new Request("https://example.test/exercise-guide", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
    body: JSON.stringify({ catalogExerciseId }),
  });
}

function dependencies(overrides: Partial<ExerciseGuideDependencies> = {}): ExerciseGuideDependencies {
  return {
    authenticate: jest.fn(async () => "user-1"),
    loadExercise: jest.fn(async () => ({
      id: 88,
      name: "One-Arm Dumbbell Row",
      mechanics: { laterality: "unilateral", equipmentClass: "dumbbell" },
      criteria: [{
        phase: "pulling phase",
        visibleGood: "The elbow follows a repeatable path.",
        coachingCue: "Drive the elbow toward your hip.",
        specificity: "movement",
      }],
      cachedGuide: null,
    })),
    generateGuide: jest.fn(async () => generatedGuide),
    saveGuide: jest.fn(async () => undefined),
    findTutorial: jest.fn(async () => null),
    ...overrides,
  };
}

describe("exerciseGuideHandler", () => {
  it("generates and caches a guide grounded in the canonical catalog exercise", async () => {
    const deps = dependencies();
    const response = await exerciseGuideHandler(request(), deps);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      exercise: { catalogExerciseId: 88, canonicalName: "One-Arm Dumbbell Row", family: "row" },
      ...generatedGuide,
      tutorial: null,
    });
    expect(deps.generateGuide).toHaveBeenCalledWith(expect.objectContaining({
      name: "One-Arm Dumbbell Row",
      mechanics: expect.objectContaining({ laterality: "unilateral" }),
      criteria: expect.arrayContaining([expect.objectContaining({ coachingCue: "Drive the elbow toward your hip." })]),
    }));
    expect(deps.saveGuide).toHaveBeenCalledWith(88, generatedGuide);
  });

  it("returns a cached guide without another provider call", async () => {
    const deps = dependencies({
      loadExercise: jest.fn(async () => ({
        id: 88,
        name: "One-Arm Dumbbell Row",
        mechanics: {},
        criteria: [],
        cachedGuide: generatedGuide,
      })),
    });
    const response = await exerciseGuideHandler(request(), deps);
    expect(await response.json()).toEqual({
      exercise: { catalogExerciseId: 88, canonicalName: "One-Arm Dumbbell Row", family: "row" },
      ...generatedGuide,
      tutorial: null,
    });
    expect(deps.generateGuide).not.toHaveBeenCalled();
  });

  it("rejects invalid or missing catalog IDs before generation", async () => {
    const deps = dependencies();
    const response = await exerciseGuideHandler(request("custom"), deps);
    expect(response.status).toBe(400);
    expect(deps.loadExercise).not.toHaveBeenCalled();
  });

  it("uses a static guide and no provider tutorial for a custom exercise name", async () => {
    const deps = dependencies();
    const response = await exerciseGuideHandler(new Request("https://example.test/exercise-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ customExerciseName: "  Jefferson Curl  " }),
    }), deps);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      exercise: { catalogExerciseId: null, canonicalName: "Jefferson Curl", family: "other" },
      family: "other",
      setup: ["Use a clear space and position any equipment securely before you begin."],
      execution: ["Move through a comfortable range you can control.", "Keep the full movement visible from start to finish."],
      safety: ["Stop if the movement causes pain or you cannot control the equipment."],
      cameraPlacement: ["Place the camera far enough away to keep your full body and equipment visible."],
      tutorial: null,
    });
    expect(deps.loadExercise).not.toHaveBeenCalled();
    expect(deps.generateGuide).not.toHaveBeenCalled();
    expect(deps.findTutorial).not.toHaveBeenCalled();
    expect(deps.saveGuide).not.toHaveBeenCalled();
  });
});
