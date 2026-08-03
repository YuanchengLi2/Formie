import { analysisStages, getAnalysisStageState } from "./stages";

describe("v46 analysis stages", () => {
  it("maps only the persisted v46 stages", () => {
    expect(analysisStages.map((stage) => stage.id)).toEqual(["input_ready", "analyzing", "finalizing", "complete"]);
    expect(getAnalysisStageState("finalizing")).toEqual(["complete", "complete", "active", "pending"]);
  });

  it("keeps all stages pending before persistence", () => {
    expect(getAnalysisStageState(null)).toEqual(Array(4).fill("pending"));
  });
});
