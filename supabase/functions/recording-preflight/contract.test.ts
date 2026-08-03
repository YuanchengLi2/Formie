import {
  PREFLIGHT_FRAME_COUNT,
  PREFLIGHT_MAX_OUTPUT_TOKENS,
  PREFLIGHT_PERSPECTIVE_MAX_OUTPUT_TOKENS,
  buildRecordingPreflightPrompt,
  buildRecordingPreflightAssessmentSchema,
  buildRecordingPreflightPerspectivePrompt,
  buildRecordingPreflightPerspectiveSchema,
  estimateRecordingPreflightCostUpperBoundUsd,
  recordingPreflightAssessmentSchema,
} from "./contract";

describe("recording preflight model contract", () => {
  it("checks complete analysis readiness and requests personalized camera guidance", () => {
    const prompt = buildRecordingPreflightPrompt({
      durationMs: 15_000,
      exerciseName: "One-Arm Dumbbell Row",
      frameTimesMs: Array.from({ length: 24 }, (_, index) => 300 + index * 625),
      visibilityRequirements: {
        source: "catalog",
        exerciseName: "One-Arm Dumbbell Row",
        bodyRegions: ["working shoulder, elbow, and hand relationship", "torso and pelvis relationship"],
        equipment: ["working dumbbell and its complete path"],
        support: ["body contact with the supporting bench"],
        movementPhases: ["start, working range, end, and return of one complete repetition"],
      },
    });

    expect(prompt).toContain("One-Arm Dumbbell Row");
    expect(prompt).toContain("mandatory body regions");
    expect(prompt).toContain("equipment");
    expect(prompt).toContain("support");
    expect(prompt).toContain("partial movement");
    expect(prompt).not.toContain("at least one complete repetition");
    expect(prompt).toContain("sustained hold");
    expect(prompt).toContain("distance");
    expect(prompt).toContain("obstruction");
    expect(prompt).toContain("lighting");
    expect(prompt).toContain("blur");
    expect(prompt).toContain("phoneHeight");
    expect(prompt).toContain("phoneTilt");
    expect(prompt).toContain("distanceAction");
    expect(prompt).toContain("Never request the full body, head, or feet");
    expect(prompt).toContain("accurate, exercise-specific coaching");
    expect(prompt).toContain("do not judge whether technique is good or bad");
    expect(prompt).toContain("working shoulder, elbow, and hand relationship");
    expect(prompt).toContain("working dumbbell and its complete path");
    expect(prompt).toContain("Do not add new mandatory requirements");
    expect(prompt).toContain("strictly more than half");
    const schema = buildRecordingPreflightAssessmentSchema([
      "working shoulder, elbow, and hand relationship",
    ]);
    expect(schema.required).toEqual(expect.arrayContaining([
      "activeMovementFrameIndices",
      "requirementEvidence",
    ]));
    expect(schema.required).not.toEqual(expect.arrayContaining([
      "visibility",
      "missingRequirements",
      "reason",
    ]));
    expect(schema.properties.requirementEvidence.items.properties.requirement.enum).toEqual([
      "working shoulder, elbow, and hand relationship",
    ]);
  });

  it("accepts imperfect recordings when exercise-critical evidence still supports accurate coaching", () => {
    const prompt = buildRecordingPreflightPrompt({
      durationMs: 12_000,
      exerciseName: "Dumbbell Shoulder Press",
      frameTimesMs: Array.from({ length: 24 }, (_, index) => 250 + index * 500),
    });

    expect(prompt).toContain("Limited recordings pass");
    expect(prompt).toContain("Do not require perfect framing");
    expect(prompt).toContain("cropped non-critical region");
    expect(prompt).toContain("optional coaching dimension");
    expect(prompt).toContain("visible in strictly more than half");
    expect(prompt).toContain("Mere presence of a person is not usable");
    expect(prompt).toContain("roughly one quarter or more of image height");
    expect(prompt).toContain("less than roughly one sixth of image height");
    expect(prompt).toContain("Apply this to unusableFrameIndices");
    expect(prompt).toContain("cameraQuality labels alone never veto");
    expect(recordingPreflightAssessmentSchema.properties.requirementEvidence).toBeDefined();
    expect(
      recordingPreflightAssessmentSchema.properties.requirementEvidence.items.properties
        .perspectiveDistortedFrameIndices,
    ).toBeUndefined();
    expect(recordingPreflightAssessmentSchema.properties.cameraQuality.enum).toContain("limited");
  });

  it("judges upward and downward camera views by lost evidence rather than camera direction", () => {
    const prompt = buildRecordingPreflightPrompt({
      durationMs: 14_000,
      exerciseName: "One-Arm Dumbbell Row",
      frameTimesMs: Array.from({ length: 24 }, (_, index) => 250 + index * 575),
    });

    expect(prompt).toContain("separate focused camera-geometry inspection");
    expect(prompt).toContain("Camera direction alone is not a limitation");
    expect(prompt).toContain("cameraLimitations");
    expect(recordingPreflightAssessmentSchema.required).toContain("cameraLimitations");
  });

  it("uses a focused camera-geometry contract for perception-changing angles", () => {
    const allowedRequirements = [
      "torso and pelvis relationship",
      "hips and knees through the full depth and return",
    ];
    const prompt = buildRecordingPreflightPerspectivePrompt({
      exerciseName: "Bodyweight Squat",
      frameTimesMs: Array.from({ length: 24 }, (_, index) => 200 + index * 400),
      allowedRequirements,
    });
    const schema = buildRecordingPreflightPerspectiveSchema(allowedRequirements);

    expect(prompt).toContain("Ignore technique quality");
    expect(prompt).toContain("another check handles visibility");
    expect(prompt).toContain("Do not assume a ground-level upward view passes");
    expect(prompt).toContain("extreme_required_segment_scale");
    expect(prompt).toContain("required_range_foreshortened");
    expect(prompt).toContain("required_body_relationship_warped");
    expect(prompt).toContain("movement endpoints themselves to be visually collapsed");
    expect(prompt).toContain("Ordinary anatomical overlap");
    expect(prompt).toContain("unambiguously and materially changed by perspective");
    expect(schema.required).toEqual([
      "perceptionChangingRequirements",
      "visibleEvidence",
    ]);
    expect(
      schema.properties.perceptionChangingRequirements.items.enum,
    ).toEqual(allowedRequirements);
  });

  it("accepts every horizontal side when the complete movement is still usable", () => {
    const prompt = buildRecordingPreflightPrompt({
      durationMs: 12_000,
      exerciseName: "Dumbbell Lateral Raise",
      frameTimesMs: Array.from({ length: 24 }, (_, index) => 250 + index * 500),
    });

    expect(prompt).toContain("front, back, side, and diagonal views are all allowed");
    expect(prompt).toContain("Distance is acceptable");
    expect(prompt).toContain("complete movement");
    expect(prompt).toContain("mandatory regions stay inside the frame");
    expect(prompt).toContain("whole body is not visible");
  });

  it("does not reject the whole recording because one coaching dimension is unavailable", () => {
    const prompt = buildRecordingPreflightPrompt({
      durationMs: 10_000,
      exerciseName: "Bodyweight Squat",
      frameTimesMs: Array.from({ length: 24 }, (_, index) => 200 + index * 400),
    });

    expect(prompt).toContain("optional coaching dimension");
    expect(prompt).toContain("without the head or feet");
    expect(prompt).toContain("torso, hips, knees");
    expect(prompt).toContain("omit claims about the cropped region");
  });

  it("keeps the configured worst-case model request below one cent", () => {
    expect(PREFLIGHT_FRAME_COUNT).toBe(24);
    expect(PREFLIGHT_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(1_024);
    expect(PREFLIGHT_PERSPECTIVE_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(256);
    expect(estimateRecordingPreflightCostUpperBoundUsd()).toBeLessThan(0.01);
  });
});
