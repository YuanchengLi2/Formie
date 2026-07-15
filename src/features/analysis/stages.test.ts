import { analysisStages, getAnalysisStageState } from "./stages";

describe("analysis stages", () => {
  it("maps every persisted backend stage without inventing percentages", () => {
    expect(analysisStages.map((stage) => stage.id)).toEqual([
      "video_check",
      "video_processing",
      "technique_review",
      "coaching",
    ]);

    expect(getAnalysisStageState("technique_review")).toEqual([
      "complete",
      "complete",
      "active",
      "pending",
    ]);
  });

  it("keeps all stages pending until analysis persists one", () => {
    expect(getAnalysisStageState(null)).toEqual(Array(4).fill("pending"));
  });
});
