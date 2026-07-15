import { analysisResultSchema } from "./result-schema";
import type { AnalysisResult, CoachingFinding } from "./result-schema";

function validFinding(id = "elbow-drift"): CoachingFinding {
  return {
    id,
    title: "Elbow drift",
    detail: "Your elbows moved forward during the concentric phase of rep 3.",
    whyItMatters: "This shifts work away from a controlled curl pattern.",
    correction: "Keep your upper arms quiet and curl through the elbows.",
    cue: "Imagine your elbows resting against a wall.",
    severity: "important",
    evidence: [
      {
        startMs: 8_000,
        endMs: 8_700,
        repNumber: 3,
        phase: "concentric",
        visualEvidence: "Both elbows move forward between 00:08.0 and 00:08.7.",
        visibleBodyAreas: ["shoulders", "elbows", "torso"],
        confidence: 0.88,
      },
    ],
  };
}

function validResult(): AnalysisResult {
  return {
    status: "complete",
    recognition: {
      label: "Standing Dumbbell Curl",
      variation: "Alternating curl",
      equipment: ["dumbbells"],
      confidence: 0.94,
      alternatives: ["Hammer curl"],
      catalogExerciseId: 35,
      cameraView: "side",
    },
    videoCheck: {
      outcome: "usable",
      usableObservations: ["side view", "upper body visible"],
      limitations: [],
      retryReason: null,
      retryInstruction: null,
    },
    overallAssessment: "Your repetitions were controlled, with some elbow drift near the end.",
    score: 82,
    scoreRationale: [
      { criterion: "elbow control", observed: "Forward drift appeared in rep 3", impact: 72, confidence: 0.88 },
      { criterion: "torso control", observed: "Torso remained stable", impact: 92, confidence: 0.91 },
    ],
    didWell: [validFinding("controlled-lowering")],
    priorityCorrections: [validFinding()],
    coachingCues: [validFinding("wall-cue")],
    viewNote: "This angle clearly showed elbow and torso control.",
    comparison: null,
  };
}

describe("analysisResultSchema", () => {
  it("accepts a complete result with timestamped evidence", () => {
    expect(analysisResultSchema.safeParse(validResult()).success).toBe(true);
  });

  it("accepts every evidence-backed finding without a fixed count cap", () => {
    const result = validResult();
    result.priorityCorrections = Array.from({ length: 7 }, (_, index) => validFinding(`correction-${index}`));
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects a finding without visual evidence", () => {
    const result = validResult();
    result.priorityCorrections[0].evidence[0].visualEvidence = "";
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects a finding with a zero-length timestamp", () => {
    const result = validResult();
    result.priorityCorrections[0].evidence[0].endMs = result.priorityCorrections[0].evidence[0].startMs;
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects evidence below the accepted confidence threshold", () => {
    const result = validResult();
    result.priorityCorrections[0].evidence[0].confidence = 0.74;
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects legacy pose evidence instead of treating it as video evidence", () => {
    const result = validResult() as unknown as Record<string, unknown>;
    const correction = (result.priorityCorrections as Array<Record<string, unknown>>)[0];
    const evidence = (correction.evidence as Array<Record<string, unknown>>)[0];
    delete evidence.visibleBodyAreas;
    evidence.mediaPipeEvidence = "A pose model estimated elbow drift.";
    evidence.observableLandmarks = ["left_elbow"];
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("allows a supported complete analysis without a score", () => {
    const result = validResult();
    result.score = null;
    result.scoreRationale = [];
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects an exercise-specific score when recognition is uncertain", () => {
    const result = validResult();
    result.recognition.confidence = 0.62;
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("requires unable results to omit feedback and include one retry reason and instruction", () => {
    const result = validResult();
    const unable: AnalysisResult = {
      ...result,
      status: "unable",
      recognition: { ...result.recognition, label: null, variation: null, confidence: 0, catalogExerciseId: null },
      videoCheck: {
        outcome: "unable",
        usableObservations: [],
        limitations: ["upper body left the frame"],
        retryReason: "Your upper body moved outside the frame.",
        retryInstruction: "Place the phone farther away and record again.",
      },
      overallAssessment: null,
      score: null,
      scoreRationale: [],
      didWell: [],
      priorityCorrections: [],
      coachingCues: [],
      viewNote: null,
    };

    expect(analysisResultSchema.safeParse(unable).success).toBe(true);
    expect(analysisResultSchema.safeParse({ ...unable, priorityCorrections: [validFinding()] }).success).toBe(false);
    expect(
      analysisResultSchema.safeParse({
        ...unable,
        videoCheck: { ...unable.videoCheck, retryInstruction: null },
      }).success,
    ).toBe(false);
  });
});
