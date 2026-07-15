import type { AnalysisResult, CoachingFinding } from "./result-schema";
import { getRecognitionLabel, getResultPresentation, getVisibleFindings } from "./presentation";

function finding(id: string, severity: CoachingFinding["severity"] = "important"): CoachingFinding {
  return {
    id,
    title: id,
    detail: `${id} detail`,
    whyItMatters: `${id} reason`,
    correction: `${id} correction`,
    cue: `${id} cue`,
    severity,
    evidence: [
      {
        startMs: 1_000,
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
    recognition: {
      label: "Standing Dumbbell Curl",
      variation: null,
      equipment: ["dumbbells"],
      confidence: 0.94,
      alternatives: [],
      catalogExerciseId: 35,
      cameraView: "side",
    },
    videoCheck: {
      outcome: "usable",
      usableObservations: ["side view"],
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
    viewNote: null,
    comparison: null,
    ...overrides,
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

  it("uses honest recognition language when the label is uncertain", () => {
    expect(getRecognitionLabel(result())).toBe("Standing Dumbbell Curl");
    expect(
      getRecognitionLabel(
        result({ recognition: { ...result().recognition, label: "Curl variation", confidence: 0.61 } }),
      ),
    ).toBe("Likely Curl variation");
    expect(
      getRecognitionLabel(
        result({ recognition: { ...result().recognition, label: null, confidence: 0.2 } }),
      ),
    ).toBe("Exercise not confidently identified");
  });

  it("exposes all user-facing result sections", () => {
    expect(getResultPresentation(result())).toEqual({
      status: "complete",
      exerciseLabel: "Standing Dumbbell Curl",
      overallAssessment: "Controlled repetitions with late elbow drift.",
      score: null,
      didWell: [finding("Stable torso", "note")],
      priorityCorrections: [finding("Elbow drift", "high")],
      coachingCues: [finding("Wall cue", "important")],
      viewNote: null,
      comparison: null,
      retryReason: null,
      retryInstruction: null,
    });
  });
});
