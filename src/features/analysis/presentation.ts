import type { AnalysisResult, CoachingFinding } from "./result-schema";

const SEVERITY_ORDER: Record<CoachingFinding["severity"], number> = {
  high: 0,
  important: 1,
  note: 2,
};

export function getVisibleFindings(findings: CoachingFinding[]): CoachingFinding[] {
  return findings
    .filter((finding) =>
      finding.evidence.some(
        (evidence) =>
          evidence.confidence >= 0.75 &&
          evidence.visualEvidence.trim().length > 0 &&
          evidence.endMs > evidence.startMs &&
          evidence.observableLandmarks.length > 0,
      ),
    )
    .toSorted((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]);
}

export function getRecognitionLabel(result: AnalysisResult): string {
  const { label, confidence } = result.recognition;
  if (!label) return "Exercise not confidently identified";
  if (confidence < 0.8) return `Likely ${label}`;
  return label;
}

export type ResultPresentation = {
  status: AnalysisResult["status"];
  exerciseLabel: string;
  overallAssessment: string | null;
  score: number | null;
  didWell: CoachingFinding[];
  priorityCorrections: CoachingFinding[];
  coachingCues: CoachingFinding[];
  viewNote: string | null;
  comparison: AnalysisResult["comparison"];
  retryReason: string | null;
  retryInstruction: string | null;
};

export function getResultPresentation(result: AnalysisResult): ResultPresentation {
  return {
    status: result.status,
    exerciseLabel: getRecognitionLabel(result),
    overallAssessment: result.overallAssessment,
    score: result.score,
    didWell: getVisibleFindings(result.didWell),
    priorityCorrections: getVisibleFindings(result.priorityCorrections),
    coachingCues: getVisibleFindings(result.coachingCues),
    viewNote: result.viewNote,
    comparison: result.comparison,
    retryReason: result.videoCheck.retryReason,
    retryInstruction: result.videoCheck.retryInstruction,
  };
}
