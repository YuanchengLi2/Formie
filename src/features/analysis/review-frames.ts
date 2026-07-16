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
