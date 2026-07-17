import type { AnalysisResult, CoachingFinding } from "./result-schema";

export type FindingSection = "strength" | "correction" | "cue";

export type ResultFindingContext = {
  finding: CoachingFinding;
  section: FindingSection;
};

export function findResultFindingContext(result: AnalysisResult, findingId: string): ResultFindingContext | null {
  const sections: Array<[FindingSection, CoachingFinding[]]> = [
    ["strength", result.didWell],
    ["correction", result.priorityCorrections],
    ["cue", result.coachingCues],
  ];
  for (const [section, findings] of sections) {
    const finding = findings.find((item) => item.id === findingId);
    if (finding) return { finding, section };
  }
  return null;
}

export function findResultFinding(result: AnalysisResult, findingId: string): CoachingFinding | null {
  return findResultFindingContext(result, findingId)?.finding ?? null;
}
