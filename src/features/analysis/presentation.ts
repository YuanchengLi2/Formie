import type { AnalysisIssue, AnalysisResult } from "./result-schema";

const SEVERITY_ORDER: Record<AnalysisIssue["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function getVisibleIssues(result: AnalysisResult): AnalysisIssue[] {
  return result.issues
    .filter(
      (issue) =>
        issue.confidence >= 0.75 &&
        issue.visualEvidence.trim().length > 0 &&
        issue.endMs > issue.startMs &&
        issue.observableLandmarks.length > 0,
    )
    .toSorted((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]);
}

export type ResultPresentation = {
  status: AnalysisResult["status"];
  score: number | null;
  issues: Array<Pick<AnalysisIssue, "title" | "whatWentWrong" | "whatToImprove">>;
  noMajorIssueSummary: string | null;
  nextRefinement: string | null;
  retryInstruction: string | null;
};

export function getResultPresentation(result: AnalysisResult): ResultPresentation {
  return {
    status: result.status,
    score: result.score,
    issues: getVisibleIssues(result).map(({ title, whatWentWrong, whatToImprove }) => ({
      title,
      whatWentWrong,
      whatToImprove,
    })),
    noMajorIssueSummary: result.noMajorIssueSummary,
    nextRefinement: result.nextRefinement,
    retryInstruction: result.retryInstruction,
  };
}
