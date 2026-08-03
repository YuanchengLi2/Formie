/* eslint-disable no-extend-native -- This test intentionally emulates Hermes without ES2023 array helpers. */
import type { AnalysisResult, CoachingFinding } from "./result-schema";
import { getRecognitionLabel, getResultPresentation, getVisibleFindings } from "./presentation";

function finding(id: string, severity: CoachingFinding["severity"] = "important"): CoachingFinding {
  return {
    id,
    coachingArea: "form",
    title: id,
    detail: `${id} detail`,
    whyItMatters: `${id} reason`,
    correction: `${id} correction`,
    cue: `${id} cue`,
    severity,
    evidence: [
      {
        startMs: 1_000,
        peakMs: 1_250,
        endMs: 1_500,
        repNumber: 1,
        phase: "concentric",
        visualEvidence: `${id} is visible`,
        visibleBodyAreas: ["elbows"],
        confidence: 0.9,
      },
    ],
  };
}

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    status: "complete",
    analysisBasis: "observed",
    viewNotes: [],
    generalGuidance: [],
    recognition: {
      label: "Standing Dumbbell Curl",
      variation: null,
      equipment: ["dumbbells"],
      confidence: 0.94,
      alternatives: [],
      catalogExerciseId: 35,
      exerciseFamily: "curl",
    },
    videoCheck: {
      outcome: "usable",
      usableObservations: ["working joints visible"],
      limitations: [],
      retryReason: null,
      retryInstruction: null,
    },
    overallAssessment: "Controlled repetitions with late elbow drift.",
    score: null,
    scoreRationale: [],
    didWell: [finding("Stable torso", "note")],
    priorityCorrections: [finding("Elbow drift", "high")],
    coachingCues: [finding("Wall cue", "important")],
    setContext: { cameraView: null, visibleReferences: [], sequenceSummary: null, changeAcrossSet: null, coachingBasis: null },
    comparison: null,
    ...overrides,
    muscleFocus: overrides.muscleFocus ?? { primary: [], secondary: [], unclassified: [] },
    coachNote: overrides.coachNote ?? null,
  };
}

describe("result presentation", () => {
  it("returns every accepted finding ordered by severity", () => {
    const visible = getVisibleFindings([
      finding("Note", "note"),
      finding("High", "high"),
      finding("Important", "important"),
      finding("Another high", "high"),
    ]);
    expect(visible.map((item) => item.title)).toEqual(["High", "Another high", "Important", "Note"]);
  });

  it("keeps supported advice even when its confidence is low", () => {
    const supported = finding("Visible optimization", "note");
    supported.evidence[0].confidence = 0.05;
    expect(getVisibleFindings([supported])).toEqual([supported]);
  });

  it("orders findings on Hermes runtimes without Array.prototype.toSorted", () => {
    const original = Array.prototype.toSorted;
    Object.defineProperty(Array.prototype, "toSorted", { configurable: true, value: undefined });
    try {
      expect(getVisibleFindings([finding("Note", "note"), finding("High", "high")]).map((item) => item.title)).toEqual(["High", "Note"]);
    } finally {
      Object.defineProperty(Array.prototype, "toSorted", { configurable: true, value: original });
    }
  });

  it("uses the pinned exercise label without uncertainty copy", () => {
    expect(getRecognitionLabel(result())).toBe("Standing Dumbbell Curl");
    expect(
      getRecognitionLabel(
        result({ recognition: { ...result().recognition, label: "Curl variation", confidence: 0.61 } }),
      ),
    ).toBe("Curl variation");
    expect(
      getRecognitionLabel(
        result({ recognition: { ...result().recognition, label: null, confidence: 0.2 } }),
      ),
    ).toBe("Exercise attempt");
  });

  it("exposes all user-facing result sections", () => {
    expect(getResultPresentation(result())).toEqual({
      status: "complete",
      exerciseLabel: "Standing Dumbbell Curl",
      overallAssessment: "Elbow drift is visible Elbow drift correction",
      score: null,
      didWell: [finding("Stable torso", "note")],
      priorityCorrections: [finding("Elbow drift", "high")],
      coachingCues: [finding("Wall cue", "important")],
      comparison: null,
      retryReason: null,
      retryInstruction: null,
    });
  });

  it("preserves the analyst score instead of applying a second punitive client cap", () => {
    const major = getResultPresentation(result({ score: 92 }));
    expect(major.score).toBe(92);
    expect(major.overallAssessment).toBe("Elbow drift is visible Elbow drift correction");

    const recurringHigh = finding("Recurring breakdown", "high");
    recurringHigh.evidence.push({
      ...recurringHigh.evidence[0],
      startMs: 3_000,
      peakMs: 3_250,
      endMs: 3_500,
      repNumber: 3,
    });
    expect(getResultPresentation(result({ score: 92, priorityCorrections: [recurringHigh] })).score).toBe(92);
  });

  it("does not reduce strong execution merely because useful notes are displayed", () => {
    expect(getResultPresentation(result({ score: 91, priorityCorrections: [finding("One note", "note")] })).score).toBe(91);
    expect(getResultPresentation(result({ score: 88, priorityCorrections: [finding("One", "note"), finding("Two", "note")] })).score).toBe(88);
    expect(getResultPresentation(result({ score: 96, priorityCorrections: [] })).score).toBe(96);
  });
});
