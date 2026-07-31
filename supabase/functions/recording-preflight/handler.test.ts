import { recordingPreflightHandler, type RecordingPreflightDependencies } from "./handler";

const frames = Array.from({ length: 24 }, (_, index) => ({
  timeMs: 200 + index * 400,
  mimeType: "image/jpeg",
  data: "a".repeat(200),
}));

const activeMovementFrameIndices = Array.from({ length: 20 }, (_, index) => index + 2);
const halfUnusableFrameIndices = activeMovementFrameIndices.slice(0, 10);
const requirements = [
  "torso and pelvis relationship",
  "hips and knees through the full depth and return",
  "start, working range, end, and return of one complete repetition",
];

function requirementEvidence(
  unusableFrames: Partial<Record<string, number[]>> = {},
) {
  return requirements.map((requirement) => ({
    requirement,
    unusableFrameIndices: unusableFrames[requirement] ?? [],
    perspectiveDistortedFrameIndices: [],
  }));
}

function assessment(overrides: Record<string, unknown> = {}) {
  return {
    activityType: "dynamic_reps",
    activeMovementFrameIndices,
    requirementEvidence: requirementEvidence(),
    cameraQuality: "sufficient",
    cameraLimitations: [],
    movementEvidence: "usable_reps",
    perspectiveAssessment: {
      perceptionChangingRequirements: [],
      visibleEvidence: [],
    },
    guidance: null,
    ...overrides,
  };
}

function dependencies(overrides: Partial<RecordingPreflightDependencies> = {}): RecordingPreflightDependencies {
  return {
    authenticate: jest.fn(async () => "user-1"),
    resolveVisibilityRequirements: jest.fn(async () => ({
      source: "catalog",
      exerciseName: "Goblet Squat",
      bodyRegions: [
        "torso and pelvis relationship",
        "hips and knees through the full depth and return",
      ],
      equipment: ["dumbbell and its relationship to the torso"],
      support: [],
      movementPhases: ["start, working range, end, and return of one complete repetition"],
    })),
    inspectFrames: jest.fn(async () => assessment({
      requirementEvidence: requirementEvidence({
        "hips and knees through the full depth and return": halfUnusableFrameIndices,
      }),
      cameraQuality: "insufficient",
      cameraLimitations: ["framing"],
      movementEvidence: "usable_reps",
      guidance: {
        phoneHeight: "hip",
        phoneTilt: "level",
        distanceAction: "move_farther",
      },
    })),
    ...overrides,
  };
}

describe("recordingPreflightHandler", () => {
  it("derives rejection from insufficient analysis visibility and returns personalized guidance", async () => {
    const deps = dependencies();
    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Goblet Squat", catalogExerciseId: 4 }),
    }), deps);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      outcome: "rerecord",
      reason: "The recording does not keep hips and knees through the full depth and return visible through most of the active movement.",
      checks: {
        activityType: "dynamic_reps",
        visibility: "insufficient",
        cameraQuality: "limited",
        cameraLimitations: ["framing"],
        movementEvidence: "usable_reps",
        visibilityRequirements: {
          source: "catalog",
          exerciseName: "Goblet Squat",
          bodyRegions: [
            "torso and pelvis relationship",
            "hips and knees through the full depth and return",
          ],
          equipment: ["dumbbell and its relationship to the torso"],
          support: [],
          movementPhases: ["start, working range, end, and return of one complete repetition"],
        },
        missingRequirements: ["hips and knees through the full depth and return"],
        perspectiveDistortedRequirements: [],
        activeMovementFrameIndices,
        requirementEvidence: requirementEvidence({
          "hips and knees through the full depth and return": halfUnusableFrameIndices,
        }),
      },
      guidance: {
        phoneSetup: "Place the phone around hip height and point it level at the center of the movement.",
        positioning: "Move farther away until the required movement stays inside the frame.",
        visibilityTarget: "Keep hips and knees through the full depth and return visible and clear.",
      },
    });
    expect(deps.inspectFrames).toHaveBeenCalledWith({
      frames,
      durationMs: 10_000,
      exerciseName: "Goblet Squat",
      catalogExerciseId: 4,
      visibilityRequirements: expect.objectContaining({ source: "catalog" }),
    });
  });

  it("passes a dynamic recording only when camera, visibility, and complete reps are all usable", async () => {
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment()),
    });
    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Goblet Squat" }),
    }), deps);

    expect(await response.json()).toEqual({
      outcome: "usable",
      reason: null,
      checks: {
        activityType: "dynamic_reps",
        visibility: "sufficient",
        cameraQuality: "sufficient",
        cameraLimitations: [],
        movementEvidence: "usable_reps",
        visibilityRequirements: expect.objectContaining({ source: "catalog" }),
        missingRequirements: [],
        perspectiveDistortedRequirements: [],
        activeMovementFrameIndices,
        requirementEvidence: requirementEvidence(),
      },
      guidance: null,
    });
  });

  it("passes a limited ground-level view when the complete movement and mandatory regions remain reliable", async () => {
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        cameraQuality: "limited",
        cameraLimitations: ["perspective_distortion"],
      })),
    });
    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "One-Arm Dumbbell Row" }),
    }), deps);

    expect(await response.json()).toMatchObject({
      outcome: "usable",
      reason: null,
      checks: {
        visibility: "sufficient",
        cameraQuality: "limited",
        cameraLimitations: ["perspective_distortion"],
        movementEvidence: "usable_reps",
        visibilityRequirements: expect.objectContaining({ source: "catalog" }),
        missingRequirements: [],
      },
      guidance: null,
    });
  });

  it("passes when every required area is visible through most active movement despite a camera-quality veto", async () => {
    const unusableFrameIndices = activeMovementFrameIndices.slice(12);
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        requirementEvidence: [
          {
            requirement: "torso and pelvis relationship",
            unusableFrameIndices,
          },
          {
            requirement: "hips and knees through the full depth and return",
            unusableFrameIndices,
          },
          {
            requirement: "start, working range, end, and return of one complete repetition",
            unusableFrameIndices,
          },
        ],
        cameraQuality: "limited",
        cameraLimitations: ["perspective_distortion"],
        guidance: {
          phoneHeight: "hip",
          phoneTilt: "level",
          distanceAction: "keep_distance",
        },
      })),
    });

    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Goblet Squat", catalogExerciseId: 4 }),
    }), deps);

    expect(await response.json()).toMatchObject({
      outcome: "usable",
      reason: null,
      checks: {
        visibility: "limited",
        cameraQuality: "limited",
        cameraLimitations: ["perspective_distortion"],
        movementEvidence: "usable_reps",
        missingRequirements: [],
        activeMovementFrameIndices,
      },
      guidance: null,
    });
  });

  it("rejects when an extreme angle changes the perceived body relationships through most active movement", async () => {
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        perspectiveAssessment: {
          perceptionChangingRequirements: [
            "torso and pelvis relationship",
            "hips and knees through the full depth and return",
          ],
          visibleEvidence: [
            "extreme_required_segment_scale",
            "required_range_foreshortened",
          ],
        },
        cameraQuality: "limited",
        cameraLimitations: ["perspective_distortion"],
        guidance: {
          phoneHeight: "hip",
          phoneTilt: "level",
          distanceAction: "keep_distance",
        },
      })),
    });

    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Goblet Squat", catalogExerciseId: 4 }),
    }), deps);

    expect(await response.json()).toMatchObject({
      outcome: "rerecord",
      reason: expect.stringMatching(/camera perspective.*torso and pelvis.*hips and knees/i),
      checks: {
        visibility: "sufficient",
        cameraQuality: "insufficient",
        perspectiveDistortedRequirements: [
          "torso and pelvis relationship",
          "hips and knees through the full depth and return",
        ],
      },
    });
  });

  it("does not make optional equipment context a recording gate when body and movement evidence pass", async () => {
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        requirementEvidence: requirementEvidence().filter(
          (evidence) => evidence.requirement !== "dumbbell and its relationship to the torso",
        ),
      })),
    });

    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Goblet Squat", catalogExerciseId: 4 }),
    }), deps);

    expect(await response.json()).toMatchObject({
      outcome: "usable",
      checks: {
        missingRequirements: [],
        requirementEvidence: expect.not.arrayContaining([
          expect.objectContaining({ requirement: "dumbbell and its relationship to the torso" }),
        ]),
      },
    });
  });

  it("normalizes non-active frame references and diagnostic camera contradictions instead of failing the check", async () => {
    const activeFrames = activeMovementFrameIndices.slice(1);
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        activeMovementFrameIndices: activeFrames,
        requirementEvidence: requirements.map((requirement) => ({
          requirement,
          unusableFrameIndices: activeMovementFrameIndices,
        })),
        cameraQuality: "sufficient",
        cameraLimitations: ["framing"],
        guidance: null,
      })),
    });

    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Goblet Squat", catalogExerciseId: 4 }),
    }), deps);

    expect(await response.json()).toMatchObject({
      outcome: "rerecord",
      checks: {
        cameraQuality: "limited",
        cameraLimitations: ["framing"],
        activeMovementFrameIndices: activeFrames,
        requirementEvidence: requirements.map((requirement) => ({
          requirement,
          unusableFrameIndices: activeFrames,
        })),
      },
      guidance: {
        phoneSetup: expect.any(String),
        positioning: expect.any(String),
        visibilityTarget: expect.any(String),
      },
    });
  });

  it("rejects visibility loss even when the camera limitation is perspective distortion", async () => {
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        requirementEvidence: requirementEvidence({
          "torso and pelvis relationship": halfUnusableFrameIndices,
        }),
        cameraQuality: "limited",
        cameraLimitations: ["perspective_distortion"],
        guidance: {
          phoneHeight: "hip",
          phoneTilt: "level",
          distanceAction: "keep_distance",
        },
      })),
    });
    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "One-Arm Dumbbell Row" }),
    }), deps);

    expect(await response.json()).toMatchObject({
      outcome: "rerecord",
      reason: "The recording does not keep torso and pelvis relationship visible through most of the active movement.",
      checks: {
        cameraQuality: "limited",
        cameraLimitations: ["perspective_distortion"],
        missingRequirements: ["torso and pelvis relationship"],
      },
      guidance: {
        phoneSetup: "Place the phone around hip height and point it level at the center of the movement.",
        positioning: "Keep your current distance.",
        visibilityTarget: expect.not.stringMatching(/full body|head|feet/i),
      },
    });
  });

  it("passes a clearly visible sustained hold without requiring repetitions", async () => {
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        activityType: "static_hold",
        movementEvidence: "usable_hold",
      })),
    });
    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Plank" }),
    }), deps);

    expect((await response.json()).outcome).toBe("usable");
  });

  it("rejects visible movement when no complete usable rep or hold is demonstrated", async () => {
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        activityType: "unclear",
        movementEvidence: "insufficient",
        guidance: {
          phoneHeight: "hip",
          phoneTilt: "level",
          distanceAction: "keep_distance",
        },
      })),
    });
    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000 }),
    }), deps);

    expect((await response.json()).outcome).toBe("rerecord");
  });

  it("rejects oversized or incomplete frame sets before calling the model", async () => {
    const deps = dependencies();
    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames: frames.slice(0, 2), durationMs: 10_000 }),
    }), deps);

    expect(response.status).toBe(400);
    expect(deps.inspectFrames).not.toHaveBeenCalled();
  });

  it("rejects when a mandatory checklist item is missing even if the model labels visibility limited", async () => {
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        requirementEvidence: requirementEvidence({
          "hips and knees through the full depth and return": halfUnusableFrameIndices,
        }),
        cameraQuality: "limited",
        cameraLimitations: ["framing"],
        guidance: {
          phoneHeight: "hip",
          phoneTilt: "level",
          distanceAction: "move_farther",
        },
      })),
    });

    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Goblet Squat", catalogExerciseId: 4 }),
    }), deps);

    expect(await response.json()).toMatchObject({
      outcome: "rerecord",
      checks: {
        visibility: "insufficient",
        missingRequirements: ["hips and knees through the full depth and return"],
      },
    });
  });

  it("rejects a model-invented mandatory item that was not in the server checklist", async () => {
    const deps = dependencies({
      inspectFrames: jest.fn(async () => assessment({
        requirementEvidence: [
          ...requirementEvidence(),
          {
            requirement: "full body including head and feet",
            unusableFrameIndices: [],
          },
        ],
        guidance: {
          phoneHeight: "hip",
          phoneTilt: "level",
          distanceAction: "move_farther",
        },
      })),
    });

    const response = await recordingPreflightHandler(new Request("https://example.test/recording-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer user-jwt" },
      body: JSON.stringify({ frames, durationMs: 10_000, exerciseName: "Goblet Squat", catalogExerciseId: 4 }),
    }), deps);

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "PREFLIGHT_FAILED" });
  });
});
