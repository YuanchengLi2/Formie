import { GEMINI_ANALYSIS_JSON_SCHEMA, validateAnalysisCandidate } from "./analysis-contract";

function candidate() {
  const evidence = {
    startMs: 1_000,
    peakMs: 1_350,
    endMs: 1_700,
    repNumber: 1,
    phase: "concentric",
    visualEvidence: "The elbows move ahead of the torso during the first repetition.",
    coachingNote: "your elbows move ahead as the dumbbells pass mid-range. Keep your upper arms beside your torso on the next rep.",
    visibleBodyAreas: ["elbows", "torso"],
    confidence: 0.88,
    focusRegion: { centerX: 0.58, centerY: 0.36, radius: 0.12, arrowFromX: 0.82, arrowFromY: 0.18, label: "right elbow", confidence: 0.9 },
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
    priorityCorrections: [{ id: "drift", title: "Reduce elbow drift", detail: "The elbows moved forward.", whyItMatters: "Shoulder motion replaces part of the curl.", correction: "Keep the upper arms quiet.", cue: "Elbows against a wall.", severity: "important", evidence: [{ ...evidence, peakMs: 1_650 }] }],
    coachingCues: [],
    setContext: {
      cameraView: "down-front diagonal",
      visibleReferences: ["shoulders relative to the seat", "handle endpoint relative to the machine frame"],
      sequenceSummary: "Three complete repetitions were visible from setup through the final reset.",
      changeAcrossSet: "The handle reached a slightly shorter endpoint during the final repetition.",
      coachingBasis: "Prioritize a repeatable handle endpoint while keeping both shoulders level.",
    },
    setSummary: { totalReps: 3, consistentReps: 2, verdict: "The last repetition changed." },
    repTimeline: [{ repNumber: 1, startMs: 500, peakMs: 900, endMs: 1_800, assessment: "consistent", note: "The repetition stayed controlled." }],
    nextSetPlan: [{ id: "plan-1", action: "Keep the upper arms still", rationale: "Reduce elbow drift.", relatedFindingId: "drift" }],
    precisionRequest: { requestedRuns: 1, reason: "The late elbow path needs a tighter timestamp check.", targets: [{ kind: "timestamp", findingId: "drift", startMs: 1_000, endMs: 1_700, question: "Does the elbow move forward at the cited peak?" }] },
    comparison: null,
  };
}

describe("Gemini analysis contract", () => {
  it("accepts one complete evidence-backed video result", () => {
    expect(validateAnalysisCandidate(candidate(), 10_000)).toEqual(candidate());
    expect(GEMINI_ANALYSIS_JSON_SCHEMA.required).toContain("recognition");
    expect(GEMINI_ANALYSIS_JSON_SCHEMA.required).toEqual(expect.arrayContaining(["setContext", "setSummary", "repTimeline", "nextSetPlan", "precisionRequest"]));
    expect(GEMINI_ANALYSIS_JSON_SCHEMA.properties.setContext.required).toEqual(["cameraView", "visibleReferences", "sequenceSummary", "changeAcrossSet", "coachingBasis"]);
    expect(GEMINI_ANALYSIS_JSON_SCHEMA.properties.priorityCorrections.items.properties.evidence.items.required).toContain("focusRegion");
    expect(GEMINI_ANALYSIS_JSON_SCHEMA.properties.priorityCorrections.items.properties.evidence.items.required).toContain("coachingNote");
  });

  it("rejects an out-of-frame visual focus target", () => {
    const value = candidate();
    value.priorityCorrections[0].evidence[0].focusRegion.centerX = 1.2;
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("focus region");
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

  it("rejects point advice that repeats a timestamp or claims hidden muscle activation", () => {
    const timestamped = candidate();
    timestamped.priorityCorrections[0].evidence[0].coachingNote = "At 0:01, your elbows move forward. Keep your upper arms beside your torso.";
    expect(() => validateAnalysisCandidate(timestamped, 10_000)).toThrow("must not repeat the timestamp");

    const hidden = candidate();
    hidden.priorityCorrections[0].evidence[0].coachingNote = "your glutes stop contributing, so drive harder through the floor.";
    expect(() => validateAnalysisCandidate(hidden, 10_000)).toThrow("hidden muscle activation");
  });

  it("requires repeated evidence before point advice blames fatigue or reduces load", () => {
    const value = candidate();
    value.priorityCorrections[0].evidence[0].coachingNote = "your elbows drift forward as fatigue develops. Reduce the load and keep your arms beside your torso.";
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("repeated evidence");
  });

  it("rejects usable coaching that omits whole-set context", () => {
    const value = candidate() as Record<string, unknown>;
    delete value.setContext;
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow(/setContext/);
  });

  it("requires different findings to cite distinct peak frames", () => {
    const value = candidate();
    value.priorityCorrections[0].evidence[0].peakMs = value.didWell[0].evidence[0].peakMs;
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("distinct evidence frames");
  });

  it("rejects finding timestamps that disagree with the referenced repetition", () => {
    const value = candidate();
    value.priorityCorrections[0].evidence[0].peakMs = 2_400;
    value.priorityCorrections[0].evidence[0].endMs = 2_700;
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("does not fall inside its referenced repetition");
  });

  it("requires one valid review target for every AI-requested premium run", () => {
    const value = candidate();
    value.precisionRequest.requestedRuns = 2;
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("precisionRequest targets must match requested runs");
  });

  it("requires a bounded video window for timestamp and technique review targets", () => {
    const value = candidate();
    value.precisionRequest.targets[0].startMs = null;
    value.precisionRequest.targets[0].endMs = null;
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("precisionRequest timestamp and technique targets require a window");
  });

  it("rejects duplicate or overlapping repetition intervals", () => {
    const value = candidate();
    value.repTimeline.push({ repNumber: 1, startMs: 1_600, peakMs: 1_900, endMs: 2_200, assessment: "breakdown", note: "Duplicate rep." });
    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("repTimeline must be ordered with unique non-overlapping repetitions");
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

  it("requires every analyzed set to include actionable next-set advice", () => {
    const value = candidate();
    value.nextSetPlan = [];

    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("analyzed result requires at least one next-set action");
  });

  it("rejects a premium receipt whose used-run count does not match its recorded passes", () => {
    const value = candidate() as ReturnType<typeof candidate> & { precisionReview: Record<string, unknown> };
    value.precisionReview = {
      runsRequested: 2,
      runsUsed: 2,
      status: "partial",
      summary: "One review completed before a failure.",
      passes: [{ passNumber: 1, kind: "recognition", outcome: "confirmed", reason: "Identity confirmed.", checkedFindingId: null, startMs: null, endMs: null, usage: { promptTokens: 10, outputTokens: 5, thinkingTokens: 2 } }],
    };

    expect(() => validateAnalysisCandidate(value, 10_000)).toThrow("premium runs used must match recorded passes");
  });
});
