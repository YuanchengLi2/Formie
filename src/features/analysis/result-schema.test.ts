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
        peakMs: 8_350,
        endMs: 8_700,
        repNumber: 3,
        phase: "concentric",
        visualEvidence: "Both elbows move forward between 00:08.0 and 00:08.7.",
        coachingNote: "both elbows move forward as the dumbbells pass mid-range. Keep your upper arms beside your torso.",
        visibleBodyAreas: ["shoulders", "elbows", "torso"],
        confidence: 0.88,
        focusRegion: { centerX: 0.58, centerY: 0.36, radius: 0.12, arrowFromX: 0.82, arrowFromY: 0.18, label: "right elbow", confidence: 0.9 },
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
      exerciseFamily: "curl",
    },
    videoCheck: {
      outcome: "usable",
      usableObservations: ["upper body visible", "working joints visible"],
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
    setSummary: { totalReps: 8, consistentReps: 6, verdict: "Control changed during the final two repetitions." },
    repTimeline: [{ repNumber: 3, startMs: 7_600, peakMs: 8_350, endMs: 9_000, assessment: "breakdown", note: "Elbow position moved forward." }],
    nextSetPlan: [{ id: "plan-1", action: "Keep the upper arms still", rationale: "Reduce shoulder assistance.", relatedFindingId: "elbow-drift" }],
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    precisionReview: { runsRequested: 2, runsUsed: 2, status: "completed", summary: "Two premium precision runs completed.", passes: [{ passNumber: 1, kind: "recognition", outcome: "confirmed", reason: "Exercise identity was confirmed.", checkedFindingId: null, startMs: null, endMs: null, usage: { promptTokens: 100, outputTokens: 20, thinkingTokens: 10 } }, { passNumber: 2, kind: "timestamp", outcome: "confirmed", reason: "The peak timestamp was confirmed.", checkedFindingId: "elbow-drift", startMs: 7_000, endMs: 9_000, usage: { promptTokens: 80, outputTokens: 20, thinkingTokens: 10 } }] },
    verification: { performed: true, reason: "Subtle joint-path claim", outcome: "confirmed", checkedFindingId: "elbow-drift" },
    comparison: null,
  };
}

describe("analysisResultSchema", () => {
  it("accepts a complete result with timestamped evidence", () => {
    const parsed = analysisResultSchema.parse(validResult());
    expect(parsed.setSummary).toMatchObject({ totalReps: 8, consistentReps: 6 });
    expect(parsed.repTimeline?.[0]).toMatchObject({ repNumber: 3, assessment: "breakdown" });
    expect(parsed.nextSetPlan?.[0]).toMatchObject({ relatedFindingId: "elbow-drift" });
    expect(parsed.verification).toMatchObject({ performed: true, outcome: "confirmed" });
    expect(parsed.precisionReview).toMatchObject({ runsUsed: 2, status: "completed" });
    expect(parsed.priorityCorrections[0].evidence[0].focusRegion).toMatchObject({ label: "right elbow", centerX: 0.58 });
    expect(parsed.priorityCorrections[0].evidence[0].coachingNote).toContain("both elbows move forward");
  });

  it("keeps legacy saved evidence compatible by defaulting visual focus to null", () => {
    const result = validResult();
    delete (result.priorityCorrections[0].evidence[0] as { focusRegion?: unknown }).focusRegion;
    expect(analysisResultSchema.parse(result).priorityCorrections[0].evidence[0].focusRegion).toBeUndefined();
  });

  it("keeps legacy saved evidence compatible when point-specific coaching is absent", () => {
    const result = validResult();
    delete (result.priorityCorrections[0].evidence[0] as { coachingNote?: unknown }).coachingNote;
    expect(analysisResultSchema.parse(result).priorityCorrections[0].evidence[0].coachingNote).toBeUndefined();
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

  it("rejects a finding timestamp outside its referenced repetition", () => {
    const result = validResult();
    result.priorityCorrections[0].evidence[0].peakMs = 9_500;
    result.priorityCorrections[0].evidence[0].endMs = 9_800;
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects legacy pose evidence instead of treating it as video evidence", () => {
    const result = validResult() as unknown as Record<string, unknown>;
    const correction = (result.priorityCorrections as Record<string, unknown>[])[0];
    const evidence = (correction.evidence as Record<string, unknown>[])[0];
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
    result.recognition.confidence = 0.52;
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
      setSummary: { totalReps: null, consistentReps: null, verdict: null },
      repTimeline: [],
      nextSetPlan: [],
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

  it("rejects analyzed coaching with no actionable next-set advice", () => {
    const result = validResult();
    result.nextSetPlan = [];

    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects a premium receipt that claims more used runs than it records", () => {
    const result = validResult();
    result.precisionReview = { ...result.precisionReview!, runsUsed: 1 };

    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });
});
