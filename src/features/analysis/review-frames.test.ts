import type { AnalysisResult, CoachingFinding } from "./result-schema";
import { buildCoachingReviewPoints, buildReviewFrames } from "./review-frames";

function resultWithTwoMoments(): AnalysisResult {
  const finding: CoachingFinding = {
    id: "uneven-shoulders",
    title: "Shoulders rise unevenly",
    detail: "The right shoulder rises first.",
    whyItMatters: "Uneven shoulders reduce repeatability.",
    correction: "Keep both shoulders level.",
    cue: "Level shoulders.",
    severity: "important",
    evidence: [
      { startMs: 1_000, peakMs: 1_200, endMs: 1_400, repNumber: 1, phase: "pull", visualEvidence: "Right shoulder rises.", visibleBodyAreas: ["shoulders"], confidence: 0.9, focusRegion: null },
      { startMs: 2_000, peakMs: 2_200, endMs: 2_400, repNumber: 2, phase: "pull", visualEvidence: "The same rise repeats.", visibleBodyAreas: ["shoulders"], confidence: 0.88, focusRegion: null },
    ],
  };

  return {
    priorityCorrections: [finding],
    coachingCues: [],
    nextSetPlan: [{ id: "next-1", action: "Square your shoulders before each pull", rationale: "Start every rep evenly.", relatedFindingId: finding.id }],
  } as unknown as AnalysisResult;
}

describe("buildReviewFrames", () => {
  it("derives multiple honest video frames for every supported purpose", () => {
    const groups = buildReviewFrames(resultWithTwoMoments());

    expect(groups.observed).toHaveLength(2);
    expect(groups.why.map((frame) => frame.body)).toEqual([
      "Uneven shoulders reduce repeatability.",
      "Uneven shoulders reduce repeatability.",
    ]);
    expect(groups.next.map((frame) => frame.title)).toEqual([
      "Square your shoulders before each pull",
      "Square your shoulders before each pull",
    ]);
    expect(new Set([...groups.observed, ...groups.why, ...groups.next].map((frame) => frame.id)).size).toBe(6);
    expect(groups.next[1].evidence.visualEvidence).toBe("The same rise repeats.");
  });

  it("omits next-set instructions that have no related visible finding", () => {
    const result = resultWithTwoMoments();
    result.nextSetPlan = [{ id: "unsupported", action: "Sleep eight hours", rationale: "Recover.", relatedFindingId: null }];
    expect(buildReviewFrames(result).next).toEqual([]);
  });

  it("keeps every supported correction and cue as one synchronized coaching-point sequence", () => {
    const value = resultWithTwoMoments();
    const source = value.priorityCorrections[0];
    const second = { ...source, id: "tempo", title: "Control the lowering", evidence: [{ ...source.evidence[0], startMs: 3_000, peakMs: 3_200, endMs: 3_400 }] };
    value.coachingCues = [second];
    value.nextSetPlan!.push({ id: "next-2", action: "Lower for two seconds", rationale: "Keep every rep repeatable.", relatedFindingId: second.id });

    const points = buildCoachingReviewPoints(value);

    expect(points).toHaveLength(3);
    expect(points.map((point) => point.observed.timeMs)).toEqual([1_200, 2_200, 3_200]);
    expect(points[2].why.timeMs).toBe(3_200);
    expect(points[2].next?.timeMs).toBe(3_200);
  });
});
