export type ScoredIssueInput = {
  id: string;
  severity: "note" | "important" | "high";
  prevalence: "isolated" | "repeated" | "throughout";
  confidence: number;
};

export type IssueScoreDetail = {
  rubricVersion: "severity-v1";
  issueId: string;
  severity: ScoredIssueInput["severity"];
  prevalence: ScoredIssueInput["prevalence"];
  scoringConfidence: number;
  penalty: number;
};

export const ISSUE_SCORE_RUBRIC_VERSION = "severity-v1" as const;

export type IssueScoreResult = {
  score: number;
  combinedPenalty: number;
  issues: IssueScoreDetail[];
};

const SEVERITY_WEIGHT = {
  note: 6,
  important: 14,
  high: 26,
} as const;

const PREVALENCE_WEIGHT = {
  isolated: 0.65,
  repeated: 1,
  throughout: 1.35,
} as const;

const COMBINED_WEIGHTS = [1, 0.75, 0.6, 0.5, 0.4] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function issuePenalty(issue: ScoredIssueInput): number {
  const scoringConfidence = 0.85 + 0.15 * clamp(issue.confidence, 0, 1);
  return SEVERITY_WEIGHT[issue.severity] * PREVALENCE_WEIGHT[issue.prevalence] * scoringConfidence;
}

export function scoreIssues(issues: readonly ScoredIssueInput[]): IssueScoreResult {
  const details = issues.map((issue) => ({
    rubricVersion: ISSUE_SCORE_RUBRIC_VERSION,
    issueId: issue.id,
    severity: issue.severity,
    prevalence: issue.prevalence,
    scoringConfidence: 0.85 + 0.15 * clamp(issue.confidence, 0, 1),
    penalty: issuePenalty(issue),
  }));
  const sortedPenalties = [...details].sort((left, right) => right.penalty - left.penalty);
  const combinedPenalty = sortedPenalties.reduce(
    (sum, detail, index) => sum + detail.penalty * (COMBINED_WEIGHTS[index] ?? 0.35),
    0,
  );
  return {
    score: Math.round(clamp(100 - combinedPenalty, 0, 100)),
    combinedPenalty,
    issues: details,
  };
}

export function scoreForIssueIds(issues: readonly ScoredIssueInput[], issueIds: readonly string[]): IssueScoreResult {
  const allowed = new Set(issueIds);
  return scoreIssues(issues.filter((issue) => allowed.has(issue.id)));
}
