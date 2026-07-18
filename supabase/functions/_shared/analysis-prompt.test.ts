import { buildAnalysisPrompt } from "./analysis-prompt";

describe("buildAnalysisPrompt", () => {
  it("keeps the analysis prompt concise while preserving the core coaching contract", () => {
    const prompt = buildAnalysisPrompt({
      profiles: [{ id: 35, name: "Standing Dumbbell Curl", aliases: ["curl"], phases: ["setup", "curl", "lower"], attentionAreas: ["elbow drift"], commonFaults: ["torso swing"] }],
      previousResult: null,
    });

    expect(prompt).toContain("Watch the entire original video from beginning to end");
    expect(prompt).toContain("Use your own visual reasoning");
    expect(prompt).toContain("all useful visible coaching");
    expect(prompt).toContain("There is no numeric limit on genuine findings");
    expect(prompt).toContain("Standing Dumbbell Curl");
    expect(prompt).toContain("priorityCorrections");
    expect(prompt).toContain("repTimeline");
    expect(prompt).toContain("focusRegion");
    expect(prompt).toContain("nextSetPlan");
    expect(prompt).toContain("precisionRequest");
    expect(prompt.split(/\s+/).length).toBeLessThan(900);
  });

  it("retains camera-angle and perspective reasoning without micromanaging the model", () => {
    const prompt = buildAnalysisPrompt({ profiles: [], previousResult: null });

    expect(prompt).toContain("infer the camera direction and angle");
    expect(prompt).toContain("mirroring");
    expect(prompt).toContain("foreshortening");
    expect(prompt).toContain("perspective distortion");
    expect(prompt).toContain("stable visible references");
    expect(prompt).toContain("same movement phase");
    expect(prompt).toContain("Do not invent precise 3D depth, distances, or joint angles");

    expect(prompt).not.toContain("BUILD WHOLE-SET CONTEXT BEFORE COACHING");
    expect(prompt).not.toContain("three sampled frames immediately before and after");
    expect(prompt).not.toContain("18 FPS primary sampling");
    expect(prompt).not.toContain("six simultaneous corrections");
    expect(prompt).not.toContain("detail to one short sentence");
    expect(prompt).not.toContain("Build a visibility-adaptive movement map");
    expect(prompt).not.toContain("MoveNet");
    expect(prompt).not.toContain("MediaPipe");
  });

  it("uses catalog identity without injecting catalog faults and keeps prior-set context separate", () => {
    const prompt = buildAnalysisPrompt({
      profiles: [{ id: 35, name: "Standing Dumbbell Curl", aliases: ["curl"], phases: ["setup", "curl", "lower"], attentionAreas: ["elbow drift"], commonFaults: ["torso swing"] }],
      previousResult: {
        status: "complete",
        priorityCorrections: [{ title: "Uneven lockout", evidence: [{ peakMs: 8_300 }] }],
        nextSetPlan: [{ action: "Finish both arms together." }],
      },
    });

    expect(prompt).toContain("Uneven lockout");
    expect(prompt).toContain("Finish both arms together.");
    expect(prompt).toContain("Previous-set timestamps are not evidence for this video");
    expect(prompt).not.toContain("elbow drift");
    expect(prompt).not.toContain("torso swing");
  });
});
