import { buildAnalysisPrompt } from "./analysis-prompt";

describe("buildAnalysisPrompt", () => {
  it("identifies imperfect exercise attempts and asks for peak-frame coaching without camera commentary", () => {
    const prompt = buildAnalysisPrompt({
      profiles: [{ id: 35, name: "Standing Dumbbell Curl", aliases: ["curl"], phases: ["setup", "curl", "lower"], attentionAreas: ["elbow drift"], commonFaults: ["torso swing"] }],
      previousResult: null,
    });

    expect(prompt).toContain("A badly performed exercise is still that exercise");
    expect(prompt).toContain("nearest standard exercise");
    expect(prompt).toContain("peakMs");
    expect(prompt).toContain("clearest single frame");
    expect(prompt).toContain("specific joint or implement path");
    expect(prompt).toContain("qualitative or estimated");
    expect(prompt).toContain("24 frames per second");
    expect(prompt).toContain("Standing Dumbbell Curl");
    expect(prompt).toContain("set overallAssessment, score, comparison, setSummary.totalReps");
    expect(prompt).toContain("retryReason and retryInstruction to specific non-empty strings");
    expect(prompt).toContain("exerciseFamily");
    expect(prompt).toContain("one or two priority corrections");
    expect(prompt).toContain("specific visible observation");
    expect(prompt).toContain("STRUCTURE THE SET FOR COACHING");
    expect(prompt).toContain("setSummary.totalReps");
    expect(prompt).toContain("Create repTimeline entries");
    expect(prompt).toContain("Create a nextSetPlan with one to five ordered physical actions");
    expect(prompt).toContain("six simultaneous corrections");
    expect(prompt).not.toContain("Capture metadata");
    expect(prompt).not.toContain("camera view");
    expect(prompt).not.toContain("angle");
    expect(prompt).not.toContain("orientation");
    expect(prompt).not.toContain("MediaPipe");
    expect(prompt).not.toContain("second pass");
  });
});
