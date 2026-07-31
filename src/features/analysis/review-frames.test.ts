import type { AnalysisResult, CoachingFinding } from "./result-schema";
import { buildCoachingReviewPoints, buildReviewFrames } from "./review-frames";

function resultWithTwoMoments(): AnalysisResult {
  const finding: CoachingFinding = {
    id: "uneven-shoulders",
    coachingArea: "form",
    title: "Shoulders rise unevenly",
    detail: "Keep the pull controlled and focus on repeatable form during the full set.",
    whyItMatters: "Uneven shoulders reduce repeatability.",
    correction: "Keep both shoulders level.",
    cue: "Level shoulders.",
    actionableCorrection: {
      instruction: "Square your shoulders before each pull.",
      cue: "Level shoulders.",
      successCheck: "Both shoulders begin and finish level.",
      applyWhen: "Before and during each pull.",
    },
    severity: "important",
    evidence: [
      { startMs: 1_000, peakMs: 1_200, endMs: 1_400, repNumber: 1, phase: "pull", visualEvidence: "Right shoulder rises.", visibleBodyAreas: ["shoulders"], confidence: 0.9, focusRegion: null },
      { startMs: 2_000, peakMs: 2_200, endMs: 2_400, repNumber: 2, phase: "pull", visualEvidence: "The same rise repeats.", visibleBodyAreas: ["shoulders"], confidence: 0.88, focusRegion: null },
    ],
  };

  return {
    priorityCorrections: [finding],
    coachingCues: [],
    nextSetPlan: [{ id: "next-1", action: "Square your shoulders before each pull", rationale: "Start every rep evenly.", successCheck: "Both shoulders begin level.", relatedFindingId: finding.id }],
  } as unknown as AnalysisResult;
}

describe("buildReviewFrames", () => {
  it("includes supported strengths in the synchronized review instead of hiding them", () => {
    const value = resultWithTwoMoments();
    value.didWell = [{ ...value.priorityCorrections[0], id: "stable-start", title: "Stable setup" }];

    expect(buildReviewFrames(value).observed.map((frame) => frame.findingId)).toContain("stable-start");
  });

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
    expect(groups.next.map((frame) => frame.body)).toEqual([undefined, undefined]);
    expect(new Set([...groups.observed, ...groups.why, ...groups.next].map((frame) => frame.id)).size).toBe(6);
    expect(groups.next[1].evidence.visualEvidence).toBe("The same rise repeats.");
  });

  it("omits next-set instructions that have no related visible finding", () => {
    const result = resultWithTwoMoments();
    result.nextSetPlan = [{ id: "unsupported", action: "Sleep eight hours", rationale: "Recover.", relatedFindingId: null }];
    expect(buildReviewFrames(result).next).toEqual([]);
  });

  it("creates one complete arrow point for every correction", () => {
    const value = resultWithTwoMoments();
    const source = value.priorityCorrections[0];
    const second = {
      ...source,
      id: "tempo",
      title: "Control the lowering",
      actionableCorrection: { ...source.actionableCorrection!, instruction: "Lower for two seconds." },
      evidence: [{ ...source.evidence[0], startMs: 3_000, peakMs: 3_200, endMs: 3_400 }],
    };
    value.priorityCorrections.push(second);
    value.nextSetPlan!.push({ id: "next-2", action: "Lower for two seconds", rationale: "Keep every rep repeatable.", successCheck: "Each lowering phase lasts two seconds.", relatedFindingId: second.id });

    const points = buildCoachingReviewPoints(value);

    expect(points).toHaveLength(2);
    expect(points[0].observed.body).toBe("Keep the pull controlled and focus on repeatable form during the full set.");
    expect(points[0].why.body).toBe("Uneven shoulders reduce repeatability.");
    expect(points[0].next.title).toBe("Square your shoulders before each pull.");
    expect(points[0].next.body).toBe("Both shoulders begin and finish level.");
    expect(points[0].observed.timeMs).toBe(1_200);
    expect(points[0].observed.timeMs).not.toBe(points[0].observed.evidence.startMs);
    expect(points[0].observed.timeMs).not.toBe(points[0].observed.evidence.endMs);
    expect(points[0].paragraph).toBe(
      "Keep the pull controlled and focus on repeatable form during the full set. Uneven shoulders reduce repeatability. Square your shoulders before each pull. Both shoulders begin and finish level.",
    );
    expect(points[1].observed.title).toBe("Control the lowering");
    expect(points[1].next.title).toBe("Lower for two seconds.");
  });

  it("never presents general advice as an observed problem in the coaching selector", () => {
    const value = resultWithTwoMoments();
    const source = value.priorityCorrections[0];
    value.coachingCues = [{
      ...source,
      id: "setup-advice",
      title: "Check the setup",
      detail: "This is general setup advice, not an observed mistake.",
      whyItMatters: "A repeatable setup makes the next set easier to compare.",
      correction: "Check that the bench is stable before starting.",
      cue: "Bench set first.",
      actionableCorrection: {
        instruction: "Check that the bench is stable before starting.",
        cue: "Bench set first.",
        successCheck: "The bench stays fixed before the first repetition.",
        applyWhen: "Before the set.",
      },
      severity: "note",
      observedIssueRegions: [],
      evidence: [{ ...source.evidence[0], visualEvidence: "The bench and floor space are visible before the first repetition." }],
    }];

    const points = buildCoachingReviewPoints(value);

    expect(points).toHaveLength(1);
    expect(points.map((point) => point.kind)).toEqual(["issue"]);
    expect(points.map((point) => point.id)).not.toContain("setup-advice");
  });

  it("uses the correction's selected primary evidence peak for every selector view", () => {
    const value = resultWithTwoMoments();
    value.priorityCorrections[0].primaryEvidenceIndex = 1;

    const point = buildCoachingReviewPoints(value)[0];

    expect(point.observed.timeMs).toBe(2_200);
    expect(point.why.timeMs).toBe(2_200);
    expect(point.next.timeMs).toBe(2_200);
    expect(point.observed.evidence.visualEvidence).toBe("The same rise repeats.");
  });

  it("uses the personalized tab-specific coaching contract", () => {
    const value = resultWithTwoMoments();
    value.priorityCorrections[0].expandedCoaching = {
      summary: "Your shoulders stop moving evenly.",
      whatHappened: "Your right shoulder rises before the handle reaches your ribs at the beginning. The left shoulder stays lower as the pull finishes. The same uneven position appears again in the middle. It remains visible near the end. The handle follows the shoulder onto a tilted path.",
      whyItMatters: "When one shoulder rises first, the handle moves on a tilted path. That makes the pull harder to repeat evenly.",
      whatToDo: "Start the next rep with both shoulders level.",
      successCheck: "Both shoulders finish at the same height.",
    };

    const point = buildCoachingReviewPoints(value)[0];

    expect(point.observed.body).toBe(value.priorityCorrections[0].expandedCoaching?.whatHappened);
    expect(point.why.body).toBe(value.priorityCorrections[0].expandedCoaching?.whyItMatters);
    expect(point.next.title).toBe("Start the next rep with both shoulders level.");
    expect(point.next.body).toBeUndefined();
    expect(point.observed.body).toBe(value.priorityCorrections[0].expandedCoaching?.whatHappened);
    expect(point.observed.body?.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(5);
    expect(point.why.body?.match(/[^.!?]+[.!?]+|[^.!?]+$/g)).toHaveLength(2);
  });
});
