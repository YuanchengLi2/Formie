import { resultPayload } from "./result-payload";

describe("resultPayload", () => {
  it("maps persisted Gemini recognition and coaching into the app contract", () => {
    expect(resultPayload(
      { detected_label: "Curl", detected_variation: null, detected_equipment: ["dumbbells"], recognition_confidence: 0.9, recognition_alternatives: [], exercise_id: 35, corrected_label: null, corrected_exercise_id: null, camera_view: "side" },
      { status: "complete", video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "Controlled", score: null, score_rationale: [], did_well: [], priority_corrections: [], coaching_cues: [], set_summary: { totalReps: 8, consistentReps: 7, verdict: "Seven stayed controlled." }, rep_timeline: [{ repNumber: 1, startMs: 100, peakMs: 500, endMs: 900, assessment: "strong", note: "Controlled" }], next_set_plan: [{ id: "plan-1", action: "Repeat the tempo", rationale: "Keep control", relatedFindingId: null }], premium_runs_used: 2, precision_review: { runsRequested: 2, runsUsed: 2, status: "completed", summary: "Reviewed", passes: [] }, verification: { performed: true, reason: "subtle", outcome: "confirmed", checkedFindingId: "finding-1" }, comparison: null },
    )).toMatchObject({
      recognition: { label: "Curl" },
      overallAssessment: "Controlled",
      setSummary: { totalReps: 8, consistentReps: 7 },
      repTimeline: [{ repNumber: 1 }],
      nextSetPlan: [{ id: "plan-1" }],
      verification: { outcome: "confirmed" },
      precisionReview: { runsUsed: 2 },
    });
  });

  it("supplies safe precision-coaching defaults for older persisted results", () => {
    expect(resultPayload(
      { detected_label: "Squat", detected_equipment: [], recognition_confidence: 0.8, recognition_alternatives: [], exercise_family: "squat" },
      { status: "partial", video_check: { outcome: "partial", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "Partially visible", score: null, score_rationale: [], did_well: [], priority_corrections: [], coaching_cues: [], comparison: null },
    )).toMatchObject({
      setSummary: { totalReps: null, consistentReps: null, verdict: null },
      repTimeline: [],
      nextSetPlan: [],
    });
  });
});
