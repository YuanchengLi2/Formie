import { buildAnalysisPrompt } from "./analysis-prompt";

describe("buildAnalysisPrompt", () => {
  it("identifies imperfect exercise attempts and asks for peak-frame coaching without camera commentary", () => {
    const prompt = buildAnalysisPrompt({
      profiles: [{ id: 35, name: "Standing Dumbbell Curl", aliases: ["curl"], phases: ["setup", "curl", "lower"], attentionAreas: ["elbow drift"], commonFaults: ["torso swing"] }],
      previousResult: null,
      poseSummary: null,
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
    expect(prompt).toContain("zero to two priority corrections");
    expect(prompt).toContain("If the movement is already technically strong");
    expect(prompt).toContain("at least one useful next-set action");
    expect(prompt).toContain("specific visible observation");
    expect(prompt).toContain("STRUCTURE THE SET FOR COACHING");
    expect(prompt).toContain("setSummary.totalReps");
    expect(prompt).toContain("Create repTimeline entries");
    expect(prompt).toContain("Create a nextSetPlan with one to five ordered physical actions");
    expect(prompt).toContain("six simultaneous corrections");
    expect(prompt).toContain("Previous-set timestamps belong only to the previous recording");
    expect(prompt).toContain("precisionRequest.requestedRuns from 0 to 3");
    expect(prompt).toContain("one target for each requested premium run");
    expect(prompt).not.toContain("Capture metadata");
    expect(prompt).not.toContain("camera view");
    expect(prompt).not.toContain("angle");
    expect(prompt).not.toContain("orientation");
    expect(prompt).not.toContain("MediaPipe");
    expect(prompt).not.toContain("second pass");
  });

  it("uses Thunder trajectories only as supplemental two-dimensional evidence", () => {
    const prompt = buildAnalysisPrompt({
      profiles: [],
      previousResult: null,
      poseSummary: { model: "MoveNet.SinglePose.Thunder", seriesColumns: ["timeMs", "leftElbowAngle"], series: [[500, 91], [750, 84]] },
    });
    expect(prompt).toContain("MoveNet.SinglePose.Thunder");
    expect(prompt).toContain("supplemental 2D estimates");
    expect(prompt).toContain("original video remains authoritative");
    expect(prompt).toContain("never infer depth");
    expect(prompt).toContain("x runs from 0 at image-left to 1 at image-right");
    expect(prompt).toContain("y runs from 0 at image-top to 1 at image-bottom");
    expect(prompt).toContain("Treat changes across several reliable frames as stronger evidence");
    expect(prompt).toContain("500");
  });

  it("provides the complete earlier coaching result without treating its timestamps as current evidence", () => {
    const prompt = buildAnalysisPrompt({
      profiles: [],
      previousResult: {
        status: "complete",
        priorityCorrections: [{ title: "Elbow drift", cue: "Only the forearms move.", evidence: [{ peakMs: 8_300 }] }],
        nextSetPlan: [{ action: "Pin the upper arms beside the torso." }],
      },
      poseSummary: null,
    });

    expect(prompt).toContain("Elbow drift");
    expect(prompt).toContain("Only the forearms move.");
    expect(prompt).toContain("Pin the upper arms beside the torso.");
    expect(prompt).toContain("Previous-set timestamps belong only to the previous recording");
  });
});
