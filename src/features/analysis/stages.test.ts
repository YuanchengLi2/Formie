import { analysisStages, getAnalysisStageState } from "./stages";

describe("analysis stages", () => {
  it("maps every persisted backend stage without inventing percentages", () => {
    expect(analysisStages.map((stage) => stage.id)).toEqual([
      "video_check",
      "pose_tracking",
      "rep_detection",
      "recognition",
      "technique_review",
      "coaching",
    ]);

    expect(getAnalysisStageState("rep_detection")).toEqual([
      "complete",
      "complete",
      "active",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("keeps all stages pending until the worker persists one", () => {
    expect(getAnalysisStageState(null)).toEqual(Array(6).fill("pending"));
  });
});
