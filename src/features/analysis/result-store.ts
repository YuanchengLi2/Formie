import type { AnalysisResult, CoachingFinding } from "./result-schema";

export function findResultFinding(result: AnalysisResult, findingId: string): CoachingFinding | null {
  return [...result.didWell, ...result.priorityCorrections, ...result.coachingCues].find((finding) => finding.id === findingId) ?? null;
}
