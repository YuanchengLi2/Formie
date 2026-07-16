import { GEMINI_ANALYSIS_JSON_SCHEMA, validateAnalysisCandidate } from "./analysis-contract";

function candidate() {
  const evidence = {
    startMs: 1_000,
    peakMs: 1_350,
    endMs: 1_700,
    repNumber: 1,
    phase: "concentric",
    visualEvidence: "The elbows move ahead of the torso during the first repetition.",
    visibleBodyAreas: ["elbows", "torso"],
    confidence: 0.88,
  };
  return {
    status: "complete",
    recognition: {
      label: "Standing Dumbbell Curl",
      variation: null,
      equipment: ["dumbbells"],
      confidence: 0.94,
      alternatives: [],
      catalogExerciseId: 35,
      exerciseFamily: "curl",
    },
    videoCheck: { outcome: "usable", usableObservations: ["upper body"], limitations: [], retryReason: null, retryInstruction: null },
    overallAssessment: "The set was controlled with some late elbow drift.",
    score: 82,
    scoreRationale: [
      { criterion: "elbow control", observed: "Late drift", impact: 72, confidence: 0.88 },
      { criterion: "torso control", observed: "Stable torso", impact: 92, confidence: 0.91 },
    ],
    didWell: [{ id: "stable", title: "Stable torso", detail: "The torso stayed quiet.", whyItMatters: "This keeps the curl repeatable.", correction: null, cue: null, severity: "note", evidence: [evidence] }],
    priorityCorrections: [{ id: "drift", title: "Reduce elbow drift", detail: "The elbows moved forward.", whyItMatters: "Shoulder motion replaces part of the curl.", correction: "Keep the upper arms quiet.", cue: "Elbows against a wall.", severity: "important", evidence: [evidence] }],
    coachingCues: [],
    setSummary: { totalReps: 3, consistentReps: 2, verdict: "The last repetition changed." },
    repTimeline: [{ repNumber: 1, startMs: 500, peakMs: 900, endMs: 1_300, assessment: "consistent", note: "The repetition stayed controlled." }],
    nextSetPlan: [{ id: "plan-1", action: "Keep the upper arms still", rationale: "Reduce elbow drift.", relatedFindingId: "drift" }],
    comparison: null,
  };
}

describe("Gemini analysis contract", () => {
  it("accepts one complete evidence-backed video result", () => {
    expect(validateAnalysisCandidate(candidate(), 10_000)).toEqual(candidate());
    expect(GEMINI_ANALYSIS_JSON_SCHEMA.required).toContain("recognition");
    expect(GEMINI_ANALYSIS_JSON_SCHEMA.required).toEqual(expect.arrayContaining(["setSummary", "repTimeline", "nextSetPlan"]));
  });

  it("rejects evidence outside the recording", () => {
    const value = candidate();
    value.priorityCorrections[0].evidence[0].endMs = 10_001;
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("outside the recorded video");
  });

  it("rejects low-confidence evidence and hidden body areas", () => {
    const lowConfidence = candidate();
    lowConfidence.priorityCorrections[0].evidence[0].confidence = 0.74;
    expect(() => validateAnalysisCandidate(lowConfidence, 10_000)).toThrow("confidence");

    const noVisibleAreas = candidate();
    noVisibleAreas.priorityCorrections[0].evidence[0].visibleBodyAreas = [];
    expect(() => validateAnalysisCandidate(noVisibleAreas, 10_000)).toThrow("visible body area");
  });

  it("rejects a score when recognition is uncertain", () => {
    const value = candidate();
    value.recognition.confidence = 0.52;
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("score requires usable recognition");
  });

  it("requires unable results to contain no coaching", () => {
    const value = candidate();
    value.status = "unable";
    value.videoCheck.outcome = "unable";
    value.videoCheck.retryReason = "The person left the frame.";
    value.videoCheck.retryInstruction = "Move the phone farther away.";
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("unable result cannot contain coaching");
  });
});
