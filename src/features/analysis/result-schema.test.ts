import { analysisResultSchema } from "./result-schema";
import type { AnalysisResult, CoachingFinding } from "./result-schema";

function validFinding(id = "elbow-drift"): CoachingFinding {
  return {
    id,
    coachingArea: "form",
    title: "Elbow drift",
    detail: "Your elbows moved forward during the concentric phase of rep 3.",
    whyItMatters: "This shifts work away from a controlled curl pattern.",
    correction: "Keep your upper arms quiet and curl through the elbows.",
    cue: "Imagine your elbows resting against a wall.",
    actionableCorrection: {
      instruction: "Keep your upper arms quiet and curl through the elbows.",
      cue: "Imagine your elbows resting against a wall.",
      successCheck: "Your elbows stay beside your torso through the curl.",
      applyWhen: "During the next set.",
    },
    expandedCoaching: {
      summary: "Your elbows move forward on the third repetition, making this the clearest issue to address next.",
      whatHappened: "The first repetitions keep the elbows beside the torso. During rep 3, both elbows travel forward as the dumbbells pass the middle of the curl, and they finish farther in front than they started.",
      whyItMatters: "That changing elbow position makes the path less repeatable. It also makes the final part of the curl visibly different from the earlier repetitions.",
      whatToDo: "Start with both upper arms beside your torso. Keep them over the same spot while the forearms and dumbbells move, and reduce the load if the elbows still move forward.",
      successCheck: "Compare the first and final repetition. The elbows should remain beside the torso through both curls.",
    },
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
    muscleFocus: {
      primary: [{ name: "Biceps", region: "biceps" }],
      secondary: [{ name: "Forearms", region: "forearms" }],
      unclassified: [],
    },
    coachNote: null,
    score: 82,
    scoreRationale: [
      { criterion: "elbow control", observed: "Forward drift appeared in rep 3", impact: 72, confidence: 0.88 },
      { criterion: "torso control", observed: "Torso remained stable", impact: 92, confidence: 0.91 },
    ],
    movementScores: [
      { id: "dumbbell-path", label: "Dumbbell Path", score: 76, observed: "The dumbbells follow the same path until the final repetitions.", evidenceIds: ["elbow-drift"] },
      { id: "torso-control", label: "Torso Control", score: 91, observed: "The torso stays upright throughout the visible set.", evidenceIds: ["controlled-lowering"] },
      { id: "top-range", label: "Top Range", score: 80, observed: "The final curl finishes slightly lower than the opening curl.", evidenceIds: ["elbow-drift"] },
    ],
    equipmentObservations: [{
      id: "load-visible",
      category: "visible_load",
      title: "Dumbbell load is not readable",
      observation: "Both dumbbells are visible, but their labels cannot be read.",
      coachingRelevance: null,
      load: { value: null, unit: null, scope: null, certainty: "unknown", basis: "not_readable" },
      evidence: [{ startMs: 8_000, peakMs: 8_350, endMs: 8_700, visualEvidence: "Both dumbbells are visible without readable labels.", visibleReferences: ["left dumbbell", "right dumbbell"], confidence: 0.9, focusRegion: null }],
    }],
    didWell: [validFinding("controlled-lowering")],
    priorityCorrections: [validFinding()],
    coachingCues: [validFinding("wall-cue")],
    setContext: {
      cameraView: "down-front diagonal",
      visibleReferences: ["shoulders relative to the seat", "handle endpoint relative to the machine frame"],
      sequenceSummary: "Eight complete repetitions were visible from setup through the final reset.",
      changeAcrossSet: "The handle reached a slightly shorter endpoint during the final two repetitions.",
      coachingBasis: "Prioritize a repeatable handle endpoint while keeping both shoulders level.",
    },
    setSummary: { totalReps: 8, consistentReps: 6, verdict: "Control changed during the final two repetitions." },
    repTimeline: [{ repNumber: 3, startMs: 7_600, peakMs: 8_350, endMs: 9_000, assessment: "breakdown", note: "Elbow position moved forward." }],
    nextSetPlan: [{ id: "plan-1", action: "Keep the upper arms still", rationale: "Reduce shoulder assistance.", successCheck: "The elbows stay beside the torso.", relatedFindingId: "elbow-drift" }],
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    comparison: null,
  };
}

describe("analysisResultSchema", () => {
  it("defaults historical findings to form while preserving supplemental coaching areas", () => {
    const result = validResult();
    const supplemental = validFinding("load-choice");
    supplemental.coachingArea = "load";
    result.priorityCorrections = [validFinding("legacy-form"), supplemental];
    result.nextSetPlan = result.priorityCorrections.map((finding, index) => ({
      id: `plan-${index}`,
      action: "Apply the correction.",
      rationale: "Keep the movement repeatable.",
      relatedFindingId: finding.id,
    }));

    const parsed = analysisResultSchema.parse(result);
    expect(parsed.priorityCorrections.map((finding) => finding.coachingArea)).toEqual(["form", "load"]);
  });

  it("accepts a complete exercise guide and rejects incomplete coaching-domain coverage", () => {
    const result: any = validResult();
    result.exerciseGuide = {
      setupSteps: ["Clear the space around the bench.", "Plant the support hand and knee."],
      executionSteps: ["Pull toward the side of the torso.", "Lower at the same pace on every rep."],
      relatedFindingIds: ["elbow-drift"],
    };
    result.coachingCoverage = [
      { domain: "surroundings", status: "clear", observation: "The visible floor space is clear.", findingIds: [] },
      { domain: "equipment_setup", status: "clear", observation: "The bench stays fixed.", findingIds: [] },
      { domain: "grip_contact", status: "clear", observation: "The grip stays consistent.", findingIds: [] },
      { domain: "starting_position", status: "clear", observation: "The start position is repeatable.", findingIds: [] },
      { domain: "movement_execution", status: "issue", observation: "The elbow drifts late.", findingIds: ["elbow-drift"] },
      { domain: "support_balance", status: "clear", observation: "The base stays planted.", findingIds: [] },
    ];

    expect(analysisResultSchema.parse(result).exerciseGuide?.setupSteps).toHaveLength(2);
    expect(analysisResultSchema.safeParse({
      ...result,
      coachingCoverage: result.coachingCoverage.slice(0, 5),
    }).success).toBe(false);
  });

  it("accepts a complete result with timestamped evidence", () => {
    const parsed = analysisResultSchema.parse(validResult());
    expect(parsed.setSummary).toMatchObject({ totalReps: 8, consistentReps: 6 });
    expect(parsed.setContext).toMatchObject({ cameraView: "down-front diagonal", visibleReferences: expect.arrayContaining([expect.stringContaining("handle endpoint")]) });
    expect(parsed.repTimeline?.[0]).toMatchObject({ repNumber: 3, assessment: "breakdown" });
    expect(parsed.nextSetPlan?.[0]).toMatchObject({ relatedFindingId: "elbow-drift" });
    expect(parsed.priorityCorrections[0].evidence[0].focusRegion).toMatchObject({ label: "right elbow", centerX: 0.58 });
    expect(parsed.priorityCorrections[0].evidence[0].coachingNote).toContain("both elbows move forward");
    expect(parsed.priorityCorrections[0].expandedCoaching?.whatHappened).toContain("During rep 3");
    expect(parsed.equipmentObservations?.[0].load?.certainty).toBe("unknown");
    expect(parsed.muscleFocus.primary[0]).toEqual({ name: "Biceps", region: "biceps" });
    expect(parsed.movementScores?.[0]).toMatchObject({ label: "Dumbbell Path", score: 76 });
  });

  it("preserves observed issue regions while defaulting legacy findings and scores", () => {
    const result = validResult();
    result.priorityCorrections[0].observedIssueRegions = ["elbows", "upper_arms"];
    expect(analysisResultSchema.parse(result).priorityCorrections[0].observedIssueRegions).toEqual(["elbows", "upper_arms"]);

    const legacy = validResult() as Record<string, unknown>;
    delete legacy.movementScores;
    delete (legacy.priorityCorrections as Record<string, unknown>[])[0].observedIssueRegions;
    const parsed = analysisResultSchema.parse(legacy);
    expect(parsed.movementScores).toBeUndefined();
    expect(parsed.priorityCorrections[0].observedIssueRegions).toBeUndefined();
  });

  it("requires three to five movement-specific scores when scores are present", () => {
    const result = validResult();
    result.movementScores = result.movementScores!.slice(0, 2);
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
    result.movementScores = Array.from({ length: 6 }, (_, index) => ({
      id: `score-${index}`,
      label: `Movement ${index}`,
      score: 80,
      observed: "This visible quality stays repeatable.",
      evidenceIds: ["elbow-drift"],
    }));
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("normalizes legacy muscle lists without guessing body regions", () => {
    const result = validResult() as unknown as Record<string, unknown>;
    result.muscleFocus = ["Biceps", "Forearms"];

    expect(analysisResultSchema.parse(result).muscleFocus).toEqual({
      primary: [],
      secondary: [],
      unclassified: ["Biceps", "Forearms"],
    });
  });

  it("rejects a muscle region classified as both primary and supporting", () => {
    const result = validResult();
    result.muscleFocus.secondary = [{ name: "Biceps support", region: "biceps" }];

    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("corrects known muscle names and leaves unknown anatomy unclassified before coloring the map", () => {
    const result = validResult();
    result.muscleFocus = {
      primary: [{ name: "Pectoralis major", region: "quads" }],
      secondary: [{ name: "Rotator cuff", region: "front_shoulders" }],
      unclassified: [],
    };

    expect(analysisResultSchema.parse(result).muscleFocus).toEqual({
      primary: [{ name: "Pectoralis major", region: "chest" }],
      secondary: [],
      unclassified: ["Rotator cuff"],
    });
  });

  it("accepts an unreadable per-hand load without inventing a numeric value", () => {
    const result = validResult();
    result.equipmentObservations![0].load = {
      value: null,
      unit: null,
      scope: "per_hand",
      certainty: "unknown",
      basis: "not_readable",
    };

    expect(analysisResultSchema.parse(result).equipmentObservations?.[0].load).toEqual({
      value: null,
      unit: null,
      scope: "per_hand",
      certainty: "unknown",
      basis: "not_readable",
    });
  });

  it("rejects partial loads that are not explicitly based on counted visible plates", () => {
    const result = validResult();
    result.equipmentObservations![0].load = {
      value: null,
      unit: null,
      scope: "per_hand",
      certainty: "partial_visible",
      basis: "not_readable",
    };

    expect(() => analysisResultSchema.parse(result)).toThrow("A partial load requires counted visible plates");
  });

  it("preserves cited body and equipment measurement IDs", () => {
    const result = validResult();
    result.priorityCorrections[0].evidence[0].measurementIds = ["left-elbow", "load-track"];
    expect(analysisResultSchema.parse(result).priorityCorrections[0].evidence[0].measurementIds).toEqual(["left-elbow", "load-track"]);
  });

  it("defaults whole-set context for legacy saved results", () => {
    const result = validResult() as Omit<AnalysisResult, "setContext"> & { setContext?: AnalysisResult["setContext"] };
    delete result.setContext;
    expect(analysisResultSchema.parse(result).setContext).toEqual({
      cameraView: null,
      visibleReferences: [],
      sequenceSummary: null,
      changeAcrossSet: null,
      coachingBasis: null,
    });
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
    result.nextSetPlan = [{ id: "plan-1", action: "Apply the first correction.", rationale: "Improve repeatability.", successCheck: "The error is no longer visible.", relatedFindingId: "correction-0" }];
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

  it("accepts low-confidence visible evidence while rejecting values below the lenient floor", () => {
    const result = validResult();
    result.priorityCorrections[0].evidence[0].confidence = 0.4;
    result.priorityCorrections[0].evidence[0].focusRegion!.confidence = 0.4;
    expect(analysisResultSchema.safeParse(result).success).toBe(true);

    result.priorityCorrections[0].evidence[0].confidence = 0.39;
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("allows an approximate marker within one second of its referenced repetition", () => {
    const result = validResult();
    result.priorityCorrections[0].evidence[0].peakMs = 9_500;
    result.priorityCorrections[0].evidence[0].endMs = 9_800;
    expect(analysisResultSchema.safeParse(result).success).toBe(true);

    result.priorityCorrections[0].evidence[0].peakMs = 10_001;
    result.priorityCorrections[0].evidence[0].endMs = 10_200;
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

  it("rejects a viewable completed analysis without a score", () => {
    const result = validResult();
    result.score = null;
    result.scoreRationale = [];
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("keeps a score when the workout is viewable but exercise recognition is uncertain", () => {
    const result = validResult();
    result.recognition.confidence = 0.52;
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects a priority issue without complete what-to-do-next coaching", () => {
    const result = validResult();
    result.priorityCorrections[0].actionableCorrection = null;

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
      movementScores: [],
      equipmentObservations: [],
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

    const explained = {
      ...unable,
      overallAssessment: "This recording cannot be analyzed because no person is visible.",
    };
    expect(analysisResultSchema.parse(explained).overallAssessment).toBe(explained.overallAssessment);
  });

  it("rejects analyzed coaching with no actionable next-set advice", () => {
    const result = validResult();
    result.nextSetPlan = [];

    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

});
