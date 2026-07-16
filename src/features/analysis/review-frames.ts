import type { AnalysisResult, CoachingFinding, EvidenceMoment } from "./result-schema";

export type ReviewPurpose = "observed" | "why" | "next";

export type ReviewFrame = {
  id: string;
  purpose: ReviewPurpose;
  title: string;
  body: string;
  findingId: string;
  finding: CoachingFinding;
  evidence: EvidenceMoment;
  timeMs: number;
};

export type ReviewFrameGroups = Record<ReviewPurpose, ReviewFrame[]>;

export type CoachingReviewPoint = {
  id: string;
  observed: ReviewFrame;
  why: ReviewFrame;
  next: ReviewFrame;
};

function frameFor(
  purpose: ReviewPurpose,
  finding: CoachingFinding,
  evidence: EvidenceMoment,
  evidenceIndex: number,
  title: string,
  body: string,
  sourceId = finding.id,
): ReviewFrame {
  return {
    id: `${purpose}-${sourceId}-${evidenceIndex}-${evidence.peakMs ?? evidence.startMs}`,
    purpose,
    title,
    body,
    findingId: finding.id,
    finding,
    evidence,
    timeMs: evidence.peakMs ?? evidence.startMs,
  };
}

export function buildReviewFrames(result: AnalysisResult): ReviewFrameGroups {
  const visibleFindings = [...result.priorityCorrections, ...result.coachingCues];
  const observed = visibleFindings.flatMap((finding) => finding.evidence.map((evidence, index) => frameFor(
    "observed",
    finding,
    evidence,
    index,
    finding.title,
    evidence.visualEvidence,
  )));
  const why = visibleFindings.flatMap((finding) => finding.evidence.map((evidence, index) => frameFor(
    "why",
    finding,
    evidence,
    index,
    finding.title,
    finding.whyItMatters,
  )));
  const findingsById = new Map(visibleFindings.map((finding) => [finding.id, finding]));
  const next = (result.nextSetPlan ?? []).flatMap((item) => {
    const finding = item.relatedFindingId ? findingsById.get(item.relatedFindingId) : null;
    if (!finding) return [];
    return finding.evidence.map((evidence, index) => frameFor(
      "next",
      finding,
      evidence,
      index,
      item.action,
      item.rationale,
      item.id,
    ));
  });

  const byTime = (left: ReviewFrame, right: ReviewFrame) => left.timeMs - right.timeMs;
  return { observed: observed.sort(byTime), why: why.sort(byTime), next: next.sort(byTime) };
}

export function buildCoachingReviewPoints(result: AnalysisResult): CoachingReviewPoint[] {
  const groups = buildReviewFrames(result);
  return groups.observed.map((observed, index) => {
    const why = groups.why.find((frame) => frame.findingId === observed.findingId && frame.timeMs === observed.timeMs) ?? frameFor(
      "why",
      observed.finding,
      observed.evidence,
      index,
      observed.finding.title,
      observed.finding.whyItMatters,
    );
    const planned = groups.next.find((frame) => frame.findingId === observed.findingId && frame.timeMs === observed.timeMs);
    const next = planned ?? frameFor(
      "next",
      observed.finding,
      observed.evidence,
      index,
      observed.finding.correction ?? observed.finding.cue ?? observed.finding.title,
      observed.finding.cue ? `Remember: ${observed.finding.cue}` : observed.finding.correction ?? observed.finding.detail,
    );
    return { id: `${observed.findingId}-${observed.timeMs}-${index}`, observed, why, next };
  });
}
