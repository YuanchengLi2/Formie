import { captureReducer, initialCaptureState } from "./capture-store";
import type { CaptureState } from "./types";

const declaration = {
  exercise: { source: "custom" as const, catalogExerciseId: null, label: "Flat Dumbbell Bench Press" },
  amount: { kind: "reps" as const, value: 8, countScope: "total" as const },
  load: { kind: "unknown" as const },
  side: "bilateral" as const,
  styles: [],
  focusNote: null,
};

const guide = {
  exercise: { catalogExerciseId: 88, canonicalName: "One-Arm Dumbbell Row", family: "row" as const },
  setup: ["Brace one hand on a stable bench."],
  execution: ["Drive the working elbow toward your hip."],
  safety: ["Keep the supporting surface from sliding."],
  cameraPlacement: ["Keep the working shoulder, elbow, wrist, torso, dumbbell, and bench visible."],
  tutorial: null,
};

describe("capture state", () => {
  it("prepares a device-saved video as a new linked analysis", () => {
    const recording = { localUri: "file:///documents/formie-recordings/set.mp4", durationMs: 12_000, mimeType: "video/mp4" };

    expect(captureReducer(initialCaptureState, {
      type: "local_reanalysis_prepared",
      recording,
      declaration,
      previousSessionId: "session-1",
    })).toEqual(expect.objectContaining({
      phase: "recorded",
      recording,
      recordingPreflight: null,
      declaration,
      previousSessionId: "session-1",
      exerciseChoice: {
        kind: "custom",
        canonicalName: "Flat Dumbbell Bench Press",
      },
    }));
  });

  it("stores an explicit selected exercise before recording", () => {
    const selected = captureReducer(initialCaptureState, {
      type: "exercise_selected",
      exercise: {
        catalogExerciseId: 88,
        canonicalName: "One-Arm Dumbbell Row",
        mechanics: { laterality: "unilateral" },
      },
    });

    expect(selected.exerciseChoice).toEqual({
      kind: "selected",
      catalogExerciseId: 88,
      canonicalName: "One-Arm Dumbbell Row",
      mechanics: { laterality: "unilateral" },
    });
  });

  it("stores a typed custom exercise for an AI-generated guide", () => {
    const custom = captureReducer(initialCaptureState, {
      type: "exercise_customized",
      canonicalName: "Jefferson curl",
    });

    expect(custom.exerciseChoice).toEqual({
      kind: "custom",
      canonicalName: "Jefferson curl",
    });
  });

  it("does not start the camera countdown until an exercise is selected", () => {
    expect(() => captureReducer(initialCaptureState, {
      type: "begin_countdown",
      countdownSeconds: 5,
    })).toThrow("exercise");
  });

  it("retains a recording gate decision, blocks bypass, and can clear it for a retry", () => {
    const recorded: CaptureState = {
      ...initialCaptureState,
      phase: "recorded",
      recording: { localUri: "file:///set.mp4", durationMs: 10_000, mimeType: "video/mp4" },
    };
    const checked = captureReducer(recorded, {
      type: "recording_preflight_completed",
      result: {
        outcome: "usable",
        reason: "Your full body leaves the frame.",
        checks: {
          activityType: "dynamic_reps",
          visibility: "insufficient",
          cameraQuality: "insufficient",
          cameraLimitations: ["framing"],
          movementEvidence: "usable_reps",
          visibilityRequirements: {
            source: "inferred",
            exerciseName: null,
            bodyRegions: ["primary moving joints and adjoining body segments"],
            equipment: [],
            support: [],
            movementPhases: ["start, working range, end, and return of one complete repetition"],
          },
          missingRequirements: ["primary moving joints and adjoining body segments"],
          perspectiveDistortedRequirements: [],
          activeMovementFrameIndices: [2, 3, 4, 5],
          requirementEvidence: [
            {
              requirement: "primary moving joints and adjoining body segments",
              unusableFrameIndices: [4, 5],
              perspectiveDistortedFrameIndices: [],
            },
            {
              requirement: "start, working range, end, and return of one complete repetition",
              unusableFrameIndices: [],
              perspectiveDistortedFrameIndices: [],
            },
          ],
        },
        guidance: {
          phoneSetup: "Raise the phone near hip height and point it level.",
          positioning: "Move back until the whole movement fits.",
          visibilityTarget: "Keep your torso, hips, knees, and equipment visible.",
        },
      },
    });

    expect(checked.recordingPreflight).toEqual(expect.objectContaining({ outcome: "usable" }));
    expect(captureReducer(checked, { type: "recording_preflight_retry_requested" }).recordingPreflight).toBeNull();
    expect(captureReducer(checked, { type: "discard_recording" }).recordingPreflight).toBeNull();
  });

  it("preserves the chosen exercise through countdown and a retake", () => {
    let state = captureReducer(initialCaptureState, {
      type: "exercise_selected",
      exercise: {
        catalogExerciseId: 88,
        canonicalName: "One-Arm Dumbbell Row",
        mechanics: { laterality: "unilateral" },
      },
    });
    state = captureReducer(state, { type: "begin_countdown", countdownSeconds: 5 });
    expect(state.exerciseChoice).toMatchObject({
      kind: "selected",
      catalogExerciseId: 88,
    });

    state = captureReducer(state, { type: "discard_recording" });
    expect(state).toMatchObject({
      phase: "idle",
      recording: null,
      declaration: null,
      exerciseChoice: {
        kind: "selected",
        catalogExerciseId: 88,
      },
    });
  });

  it("caches a matching setup guide through recording and clears it when the exercise changes", () => {
    let state = captureReducer(initialCaptureState, {
      type: "exercise_selected",
      exercise: {
        catalogExerciseId: 88,
        canonicalName: "One-Arm Dumbbell Row",
        mechanics: { laterality: "unilateral" },
      },
    });
    state = captureReducer(state, {
      type: "exercise_guide_loaded",
      key: "catalog:88",
      guide,
    });
    state = captureReducer(state, { type: "begin_countdown", countdownSeconds: 5 });
    expect(state).toMatchObject({
      exerciseGuideKey: "catalog:88",
      exerciseGuide: guide,
    });

    state = captureReducer(state, { type: "discard_recording" });
    expect(state).toMatchObject({
      exerciseGuideKey: "catalog:88",
      exerciseGuide: guide,
    });

    state = captureReducer(state, {
      type: "exercise_customized",
      canonicalName: "Jefferson curl",
    });
    expect(state.exerciseGuide).toBeNull();
    expect(state.exerciseGuideKey).toBeNull();
  });

  it("invalidates a completed camera check only when the exercise changes", () => {
    const preflight = {
      outcome: "usable" as const,
      reason: null,
      checks: {
        activityType: "dynamic_reps" as const,
        visibility: "sufficient" as const,
        cameraQuality: "sufficient" as const,
        cameraLimitations: [],
        movementEvidence: "usable_reps" as const,
        visibilityRequirements: {
          source: "catalog" as const,
          exerciseName: "One-Arm Dumbbell Row",
          bodyRegions: ["working shoulder, elbow, and wrist"],
          equipment: ["dumbbell"],
          support: ["bench"],
          movementPhases: ["start, working range, end, and return of one complete repetition"],
        },
        missingRequirements: [],
        perspectiveDistortedRequirements: [],
        activeMovementFrameIndices: [2, 3, 4, 5],
        requirementEvidence: [
          {
            requirement: "working shoulder, elbow, and wrist",
            unusableFrameIndices: [],
            perspectiveDistortedFrameIndices: [],
          },
          {
            requirement: "start, working range, end, and return of one complete repetition",
            unusableFrameIndices: [],
            perspectiveDistortedFrameIndices: [],
          },
        ],
      },
      guidance: null,
    };
    const selected = {
      kind: "selected" as const,
      catalogExerciseId: 88,
      canonicalName: "One-Arm Dumbbell Row",
      mechanics: { laterality: "unilateral" },
    };
    const checked: CaptureState = {
      ...initialCaptureState,
      phase: "recorded",
      exerciseChoice: selected,
      recording: { localUri: "file:///set.mp4", durationMs: 10_000, mimeType: "video/mp4" },
      recordingPreflight: preflight,
    };

    const sameExercise = captureReducer(checked, {
      type: "exercise_selected",
      exercise: {
        catalogExerciseId: 88,
        canonicalName: "One-Arm Dumbbell Row",
        mechanics: { laterality: "unilateral" },
      },
    });
    expect(sameExercise.recordingPreflight).toBe(preflight);

    const changedExercise = captureReducer(checked, {
      type: "exercise_customized",
      canonicalName: "Seated One-Arm Dumbbell Extension",
    });
    expect(changedExercise.recordingPreflight).toBeNull();
  });

  it("reuses a matching generated setup when a saved video is prepared for reanalysis", () => {
    let state = captureReducer(initialCaptureState, {
      type: "exercise_selected",
      exercise: {
        catalogExerciseId: 88,
        canonicalName: "One-Arm Dumbbell Row",
        mechanics: { laterality: "unilateral" },
      },
    });
    state = captureReducer(state, {
      type: "exercise_guide_loaded",
      key: "catalog:88",
      guide,
    });
    state = captureReducer(state, {
      type: "local_reanalysis_prepared",
      recording: { localUri: "file:///saved-row.mp4", durationMs: 8_000, mimeType: "video/mp4" },
      declaration: {
        ...declaration,
        exercise: { source: "catalog", catalogExerciseId: 88, label: "One-Arm Dumbbell Row" },
      },
      previousSessionId: "session-row",
    });

    expect(state).toMatchObject({
      exerciseGuideKey: "catalog:88",
      exerciseGuide: guide,
    });
  });

  it("moves through countdown, local review, declared upload, and processing", () => {
    let state = captureReducer(initialCaptureState, {
      type: "exercise_customized",
      canonicalName: "Flat Dumbbell Bench Press",
    });
    state = captureReducer(state, { type: "begin_countdown", previousSessionId: "prior-1" });
    expect(state).toMatchObject({ phase: "countingDown", countdown: 10, previousSessionId: "prior-1" });

    for (let count = 0; count < 10; count += 1) state = captureReducer(state, { type: "countdown_tick" });
    expect(state.countdown).toBe(0);

    state = captureReducer(state, { type: "recording_started", startedAt: 1_000 });
    state = captureReducer(state, {
      type: "recording_finished",
      recording: { localUri: "file:///set.mp4", durationMs: 18_000, mimeType: "video/mp4" },
    });
    state = captureReducer(state, { type: "declaration_submitted", declaration });
    state = captureReducer(state, { type: "upload_started" });
    expect(state.uploadSubstage).toBe("creating_session");
    state = captureReducer(state, {
      type: "upload_progress",
      substage: "uploading_original",
      target: {
        sessionId: "session-1",
        original: { signedUrl: "https://storage.example/original", uploadToken: "original-token", path: "user/session-1/original.mp4" },
        analysis: { signedUrl: "https://storage.example/analysis", uploadToken: "analysis-token", path: "user/session-1/analysis-input.mp4" },
      },
    });
    expect(state).toMatchObject({ uploadSubstage: "uploading_original", sessionId: "session-1" });
    state = captureReducer(state, { type: "processing", sessionId: "session-1" });

    expect(state).toMatchObject({
      phase: "processing",
      sessionId: "session-1",
      recording: { localUri: "file:///set.mp4", durationMs: 18_000 },
      declaration,
      uploadSubstage: null,
    });
  });

  it("uses the selected device countdown length", () => {
    const selected = captureReducer(initialCaptureState, {
      type: "exercise_customized",
      canonicalName: "Goblet Squat",
    });
    expect(captureReducer(selected, { type: "begin_countdown", countdownSeconds: 5 }).countdown).toBe(5);
    expect(captureReducer(selected, { type: "begin_countdown", countdownSeconds: 15 }).countdown).toBe(15);
  });

  it("preserves the local recording through an upload failure and retry", () => {
    let state: CaptureState = {
      ...initialCaptureState,
      phase: "recorded" as const,
      recording: { localUri: "file:///set.mp4", durationMs: 12_000, mimeType: "video/mp4" },
    };

    state = captureReducer(state, { type: "declaration_submitted", declaration });
    state = captureReducer(state, { type: "upload_started" });
    state = captureReducer(state, {
      type: "upload_target_created",
      target: {
        sessionId: "session-1",
        original: {
          signedUrl: "https://storage.example/original",
          uploadToken: "original-token",
          path: "user/session-1/original.mp4",
        },
        analysis: {
          signedUrl: "https://storage.example/analysis",
          uploadToken: "analysis-token",
          path: "user/session-1/analysis-input.mp4",
        },
      },
    });
    state = captureReducer(state, { type: "upload_failed", message: "Connection lost" });

    expect(state.phase).toBe("error");
    expect(state.recording?.localUri).toBe("file:///set.mp4");
    expect(state.uploadTarget?.sessionId).toBe("session-1");

    state = captureReducer(state, { type: "retry_upload" });
    expect(state).toMatchObject({
      phase: "uploading",
      error: null,
      recording: { localUri: "file:///set.mp4" },
      declaration,
      uploadTarget: { sessionId: "session-1" },
    });
  });

  it("does not allow upload until a valid declaration is stored", () => {
    const recorded: CaptureState = {
      ...initialCaptureState,
      phase: "recorded",
      recording: { localUri: "file:///set.mp4", durationMs: 12_000, mimeType: "video/mp4" },
    };
    expect(() => captureReducer(recorded, { type: "upload_started" })).toThrow("declaration");
  });

  it("rejects impossible transitions", () => {
    expect(() => captureReducer(initialCaptureState, { type: "recording_started", startedAt: 1_000 })).toThrow(
      "Cannot start recording from idle",
    );
  });

  it("distinguishes a camera failure from a saved upload failure", () => {
    const recordingState: CaptureState = {
      ...initialCaptureState,
      phase: "recording",
      startedAt: 1_000,
    };
    const failed = captureReducer(recordingState, { type: "recording_failed", message: "Camera stopped" });
    expect(failed).toMatchObject({ phase: "error", recording: null, error: "Camera stopped" });
  });
});
