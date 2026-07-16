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
    expect(prompt).toContain("clearest peak frame");
    expect(prompt).toContain("specific joint or implement path");
    expect(prompt).toContain("qualitative or estimated");
    expect(prompt).toContain("entire original recording");
    expect(prompt).toContain("Standing Dumbbell Curl");
    expect(prompt).toContain("set overallAssessment, score, comparison, setSummary.totalReps");
    expect(prompt).toContain("retryReason and retryInstruction to specific non-empty strings");
    expect(prompt).toContain("exerciseFamily");
    expect(prompt).toContain("every distinct material correction");
    expect(prompt).toContain("There is no numeric cap on genuine findings");
    expect(prompt).toContain("setup and bracing, timing and tempo, joint and implement placement, range of motion, stability, symmetry, sequencing, and rep-to-rep consistency");
    expect(prompt).toContain("evaluate every factor that is actually visible");
    expect(prompt).toContain("state which factors cannot be judged");
    expect(prompt).toContain("setup, early, middle, and late phases");
    expect(prompt).toContain("largest visible displacement");
    expect(prompt).toContain("Never add a weaker duplicate or filler finding");
    expect(prompt).toContain("early, middle, and late repetitions");
    expect(prompt).toContain("Multiple distinct findings may belong to the same repetition");
    expect(prompt).toContain("one to four evidence moments");
    expect(prompt).toContain("repNumber to null for setup or between-rep moments");
    expect(prompt).toContain("Do not create a coaching point for a repetition that has no material issue");
    expect(prompt).toContain("focusRegion");
    expect(prompt).toContain("normalized source-frame coordinates");
    expect(prompt).toContain("set focusRegion to null");
    expect(prompt).toContain("coachingNote");
    expect(prompt).toContain("The app adds the timestamp");
    expect(prompt).toContain("visible event at that exact moment");
    expect(prompt).toContain("Do not claim that a muscle stopped contributing");
    expect(prompt).toContain("Use repeated late-set deterioration before calling fatigue");
    expect(prompt).toContain("point-specific correction");
    expect(prompt).toContain("compare early, middle, and late repetitions");
    expect(prompt).toContain("Do not call one isolated poor repetition fatigue");
    expect(prompt).toContain("Recommend reducing load only when repeated visible breakdown");
    expect(prompt).toContain("detail to one short sentence");
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
    expect(prompt).not.toContain("MoveNet");
    expect(prompt).not.toContain("pose");
    expect(prompt).not.toContain("second pass");
  });

  it("does not add a body-tracking layer to Gemini coaching", () => {
    const prompt = buildAnalysisPrompt({
      profiles: [],
      previousResult: null,
    });
    expect(prompt).not.toContain("MoveNet");
    expect(prompt).not.toContain("Supplemental local movement estimates");
  });

  it("provides the complete earlier coaching result without treating its timestamps as current evidence", () => {
    const prompt = buildAnalysisPrompt({
      profiles: [],
      previousResult: {
        status: "complete",
        priorityCorrections: [{ title: "Elbow drift", cue: "Only the forearms move.", evidence: [{ peakMs: 8_300 }] }],
        nextSetPlan: [{ action: "Pin the upper arms beside the torso." }],
      },
    });

    expect(prompt).toContain("Elbow drift");
    expect(prompt).toContain("Only the forearms move.");
    expect(prompt).toContain("Pin the upper arms beside the torso.");
    expect(prompt).toContain("Previous-set timestamps belong only to the previous recording");
  });
});
