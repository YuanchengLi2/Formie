import { buildAnalysisPrompt } from "./analysis-prompt";

describe("buildAnalysisPrompt", () => {
  it("creates one view-aware video coaching request without pose layers", () => {
    const prompt = buildAnalysisPrompt({
      capture: { orientation: "landscapeLeft", facing: "back", lens: "wideAngleCamera", durationMs: 15_000, requestedFps: 24 },
      profiles: [{ id: 35, name: "Standing Dumbbell Curl", aliases: ["curl"], phases: ["setup", "curl", "lower"], attentionAreas: ["elbow drift"], commonFaults: ["torso swing"] }],
      previousResult: null,
    });

    expect(prompt).toContain("front, side, diagonal, elevated, low, or uncertain");
    expect(prompt).toContain("Do not infer details hidden from the recorded camera view");
    expect(prompt).toContain("qualitative or estimated");
    expect(prompt).toContain("24 frames per second");
    expect(prompt).toContain("Standing Dumbbell Curl");
    expect(prompt).not.toContain("MediaPipe");
    expect(prompt).not.toContain("second pass");
  });
});
