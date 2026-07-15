import { analysisResultSchema } from "./result-schema";
import type { AnalysisIssue, AnalysisResult } from "./result-schema";

function validIssue(): AnalysisIssue {
  return {
    title: "Elbow drift",
    whatWentWrong: "Your elbows moved forward during the concentric phase of rep 3.",
    whatToImprove: "Keep your upper arms quiet and curl through the elbows.",
    startMs: 8_000,
    endMs: 8_700,
    repNumber: 3,
    visualEvidence: "Both elbow centers move anterior to the shoulder line between 00:08.0 and 00:08.7.",
    poseEvidence: "Mean elbow-to-shoulder x-offset increased by 12% during concentric phase.",
    severity: "medium" as const,
    confidence: 0.88,
    observableLandmarks: ["left_shoulder", "right_shoulder", "left_elbow", "right_elbow"],
  };
}

function validCompleteResult(): AnalysisResult {
  return {
    status: "complete" as const,
    score: 82,
    scoreRationale: [
      { criterion: "elbow control", observed: "Forward drift appeared in rep 3", impact: 72, confidence: 0.88 },
      { criterion: "torso control", observed: "Torso remained stable", impact: 92, confidence: 0.91 },
    ],
    issues: [validIssue()],
    noMajorIssueSummary: null,
    nextRefinement: null,
    retryInstruction: null,
  };
}

describe("analysisResultSchema", () => {
  it("accepts a complete result with timestamped evidence", () => {
    expect(analysisResultSchema.safeParse(validCompleteResult()).success).toBe(true);
  });

  it("rejects an issue without visual evidence", () => {
    const result = validCompleteResult();
    result.issues[0].visualEvidence = "";
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects an issue with a zero-length timestamp", () => {
    const result = validCompleteResult();
    result.issues[0].endMs = result.issues[0].startMs;
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("caps AI-selected issues at three", () => {
    const result = validCompleteResult();
    result.issues = [validIssue(), validIssue(), validIssue(), validIssue()];
    expect(analysisResultSchema.safeParse(result).success).toBe(false);
  });

  it("allows a strong set with no manufactured issue", () => {
    const result = validCompleteResult();
    result.issues = [];
    result.noMajorIssueSummary = "No major form issue detected in the visible set.";
    result.nextRefinement = "Keep the same elbow position as fatigue increases.";
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
  });

  it("requires unable results to omit score and provide a retry instruction", () => {
    const result = {
      status: "unable",
      score: null,
      scoreRationale: [],
      issues: [],
      noMajorIssueSummary: null,
      nextRefinement: null,
      retryInstruction: "Move the phone farther back so both elbows remain visible.",
    };
    expect(analysisResultSchema.safeParse(result).success).toBe(true);
    expect(analysisResultSchema.safeParse({ ...result, score: 50 }).success).toBe(false);
  });
});
