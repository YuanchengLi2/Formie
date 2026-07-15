import type { AnalysisIssue, AnalysisResult } from "./result-schema";
import { getResultPresentation, getVisibleIssues } from "./presentation";

function issue(overrides: Partial<AnalysisIssue> = {}): AnalysisIssue {
  return {
    title: "Elbow drift",
    whatWentWrong: "Your elbow moved forward during rep 3.",
    whatToImprove: "Keep the elbow close to your side.",
    startMs: 8_000,
    endMs: 8_500,
    repNumber: 3,
    visualEvidence: "Visible elbow movement at 00:08.",
    poseEvidence: null,
    severity: "medium",
    confidence: 0.88,
    observableLandmarks: ["left_elbow"],
    ...overrides,
  };
}

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    status: "complete",
    score: 84,
    scoreRationale: [
      { criterion: "elbow control", observed: "One visible drift", impact: 76, confidence: 0.88 },
      { criterion: "torso control", observed: "Torso stayed quiet", impact: 92, confidence: 0.9 },
    ],
    issues: [issue()],
    noMajorIssueSummary: null,
    nextRefinement: null,
    retryInstruction: null,
    ...overrides,
  };
}

describe("result presentation", () => {
  it("keeps only evidence-backed issues at or above 0.75 confidence", () => {
    const visible = getVisibleIssues(
      result({
        issues: [
          issue({ title: "High", severity: "high", confidence: 0.91 }),
          issue({ title: "Low confidence", confidence: 0.74 }),
          issue({ title: "No evidence", visualEvidence: "" }),
          issue({ title: "Bad time", startMs: 8_000, endMs: 8_000 }),
        ],
      }),
    );
    expect(visible.map((item) => item.title)).toEqual(["High"]);
  });

  it("sorts higher-severity issues first", () => {
    const visible = getVisibleIssues(
      result({ issues: [issue({ title: "Low", severity: "low" }), issue({ title: "High", severity: "high" })] }),
    );
    expect(visible.map((item) => item.title)).toEqual(["High", "Low"]);
  });

  it("exposes only the simple user-facing result fields", () => {
    expect(getResultPresentation(result())).toEqual({
      status: "complete",
      score: 84,
      issues: [
        {
          title: "Elbow drift",
          whatWentWrong: "Your elbow moved forward during rep 3.",
          whatToImprove: "Keep the elbow close to your side.",
        },
      ],
      noMajorIssueSummary: null,
      nextRefinement: null,
      retryInstruction: null,
    });
  });
});
