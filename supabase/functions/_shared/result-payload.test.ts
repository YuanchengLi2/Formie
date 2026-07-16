import { resultPayload } from "./result-payload";

describe("resultPayload", () => {
  it("maps persisted Gemini recognition and coaching into the app contract", () => {
    expect(resultPayload(
      { detected_label: "Curl", detected_variation: null, detected_equipment: ["dumbbells"], recognition_confidence: 0.9, recognition_alternatives: [], exercise_id: 35, corrected_label: null, corrected_exercise_id: null, camera_view: "side" },
      { status: "complete", video_check: { outcome: "usable", usableObservations: [], limitations: [], retryReason: null, retryInstruction: null }, overall_assessment: "Controlled", score: null, score_rationale: [], did_well: [], priority_corrections: [], coaching_cues: [], view_note: "Side view", comparison: null },
    )).toMatchObject({ recognition: { label: "Curl" }, overallAssessment: "Controlled" });
  });
});
