import type { AnalysisResult, CoachingFinding, EvidenceMoment } from "./result-schema";

export type ReviewPurpose = "observed" | "why" | "next";

export type ReviewFrame = {
  id: string;
  purpose: ReviewPurpose;
  title: string;
  body?: string;
  detail?: string;
  findingId: string;
  finding: CoachingFinding;
  evidence: EvidenceMoment;
  timeMs: number;
};

export type ReviewFrameGroups = Record<ReviewPurpose, ReviewFrame[]>;

export type CoachingReviewPoint = {
  id: string;
  kind: "issue" | "advice";
  paragraph: string;
  observed: ReviewFrame;
  why: ReviewFrame;
  next: ReviewFrame;
};

function coachingCopy(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function frameFor(
  purpose: ReviewPurpose,
  finding: CoachingFinding,
  evidence: EvidenceMoment,
  evidenceIndex: number,
  title: string,
  body: string | undefined,
  detail: string | undefined,
  sourceId = finding.id,
): ReviewFrame {
  return {
    id: `${purpose}-${sourceId}-${evidenceIndex}-${evidence.peakMs ?? evidence.startMs}`,
    purpose,
    title,
    body,
    detail,
    findingId: finding.id,
    finding,
    evidence,
    timeMs: evidence.peakMs ?? evidence.startMs,
  };
}

export function buildReviewFrames(result: AnalysisResult): ReviewFrameGroups {
  const points = buildCoachingReviewPoints(result);
  const observed = points.map((point) => point.observed);
  const why = points.map((point) => point.why);
  const next = points.map((point) => point.next);
  const byTime = (left: ReviewFrame, right: ReviewFrame) => left.timeMs - right.timeMs;
  return { observed: observed.sort(byTime), why: why.sort(byTime), next: next.sort(byTime) };
}

export function buildCoachingReviewPoints(result: AnalysisResult): CoachingReviewPoint[] {
  const cueFindings: { finding: CoachingFinding; kind: "issue" | "advice" }[] = [];
  for (const finding of result.coachingCues) {
    if (finding.coachingType === "correction") cueFindings.push({ finding, kind: "issue" });
    if (finding.coachingType === "optimization") cueFindings.push({ finding, kind: "advice" });
  }
  const findings: { finding: CoachingFinding; kind: "issue" | "advice" }[] = [
    ...result.priorityCorrections.map((finding) => ({ finding, kind: "issue" as const })),
    ...cueFindings,
  ];
  return findings.map(({ finding, kind }) => {
    const evidenceIndex = Math.min(finding.primaryEvidenceIndex ?? 0, finding.evidence.length - 1);
    const evidence = finding.evidence[evidenceIndex];
    const action = finding.actionableCorrection;
    const expanded = finding.expandedCoaching;
    const observed = frameFor(
      "observed",
      finding,
      evidence,
      evidenceIndex,
      finding.title,
      coachingCopy(expanded?.whatHappened || finding.detail),
      coachingCopy(expanded?.whatHappenedDetail),
      finding.id,
    );
    const why = frameFor(
      "why",
      finding,
      evidence,
      evidenceIndex,
      finding.title,
      coachingCopy(expanded?.whyItMatters || finding.whyItMatters),
      coachingCopy(expanded?.whyItMattersDetail),
      finding.id,
    );
    const next = frameFor(
      "next",
      finding,
      evidence,
      evidenceIndex,
      coachingCopy(expanded?.whatToDo ?? action?.instruction ?? finding.correction ?? finding.cue ?? finding.title) ?? finding.title,
      undefined,
      undefined,
    );
    const paragraph = [
      observed.body,
      why.body,
      next.title,
      next.body,
    ].filter((value): value is string => Boolean(value)).join(" ");
    return { id: finding.id, kind, paragraph, observed, why, next };
  });
}
