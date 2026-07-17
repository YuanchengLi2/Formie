import { buildAnalysisPrompt } from "./analysis-prompt";

describe("buildAnalysisPrompt", () => {
  it("identifies imperfect exercise attempts and asks for peak-frame coaching without camera commentary", () => {
    const prompt = buildAnalysisPrompt({
      profiles: [{ id: 35, name: "Standing Dumbbell Curl", aliases: ["curl"], phases: ["setup", "curl", "lower"], attentionAreas: ["elbow drift"], commonFaults: ["torso swing"] }],
      previousResult: null,
    });

    expect(prompt).toContain("A badly performed exercise is still that exercise");
    expect(prompt).toContain("Use your full native video-understanding ability");
    expect(prompt).toContain("Do not limit the analysis to the examples, reference profiles, named attention areas, or common faults");
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
    expect(prompt).toContain("Treat every camera angle as a source of usable evidence");
    expect(prompt).toContain("relative phase speed, acceleration and deceleration");
    expect(prompt).toContain("which joint, body segment, or implement visibly starts each phase");
    expect(prompt).toContain("Build a visibility-adaptive movement map");
    expect(prompt).toContain("BUILD WHOLE-SET CONTEXT BEFORE COACHING");
    expect(prompt).toContain("Populate setContext before choosing any finding");
    expect(prompt).toContain("same phase across early, middle, and late repetitions");
    expect(prompt).toContain("front and down-front views");
    expect(prompt).toContain("relative-depth cues");
    expect(prompt).toContain("shoulder travel");
    expect(prompt).toContain("handle, lever, plate, cable attachment, or machine carriage endpoint");
    expect(prompt).toContain("occlusion order and overlap changes");
    expect(prompt).toContain("Never invent metric 3D depth, distance, or joint angles");
    expect(prompt).toContain("initiation, mid-range, transition, completion, return, and reset");
    expect(prompt).toContain("onset delay, brief reversal, path wobble");
    expect(prompt).toContain("movement direction of every visible hand, wrist, elbow, shoulder");
    expect(prompt).toContain("perspective distortion");
    expect(prompt).toContain("infer the camera direction");
    expect(prompt).toContain("front, rear, left side, right side, high, low, or diagonal");
    expect(prompt).toContain("foreshortening");
    expect(prompt).toContain("wide-angle lens distortion");
    expect(prompt).toContain("apparent size alone");
    expect(prompt).toContain("same anatomical phase");
    expect(prompt).toContain("mirrored front-camera footage");
    expect(prompt).toContain("Report every distinct visible and actionable technical deviation");
    expect(prompt).toContain("distinguish not visible from visibly incorrect");
    expect(prompt).toContain("evaluate every factor that is actually visible");
    expect(prompt).toContain("state which factors cannot be judged");
    expect(prompt).toContain("setup, early, middle, and late phases");
    expect(prompt).toContain("largest visible displacement");
    expect(prompt).toContain("three sampled frames immediately before and after");
    expect(prompt).toContain("18 FPS primary sampling");
    expect(prompt).toContain("Never add a weaker duplicate or filler finding");
    expect(prompt).toContain("early, middle, and late repetitions");
    expect(prompt).toContain("Multiple distinct findings may belong to the same repetition");
    expect(prompt).toContain("different peak frame for every distinct finding");
    expect(prompt).toContain("redirect attention to other visible relationships");
    expect(prompt).toContain("contrast the early-set baseline with at least two later repetitions");
    expect(prompt).toContain("one or more evidence moments");
    expect(prompt).toContain("Do not cap recurring evidence at four moments");
    expect(prompt).not.toContain("one to four evidence moments");
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
    expect(prompt).toContain("setContext.sequenceSummary");
    expect(prompt).toContain("setSummary.totalReps");
    expect(prompt).toContain("Create repTimeline entries");
    expect(prompt).toContain("Never default to three repetitions");
    expect(prompt).toContain("Count each complete movement cycle from the first visible repetition through the last");
    expect(prompt).toContain("Create a nextSetPlan with one to five ordered physical actions");
    expect(prompt).toContain("six simultaneous corrections");
    expect(prompt).toContain("Previous-set timestamps belong only to the previous recording");
    expect(prompt).toContain("precisionRequest.requestedRuns to 0 or 1");
    expect(prompt).toContain("single material uncertainty");
    expect(prompt).not.toContain("Capture metadata");
    expect(prompt).not.toContain("move the camera");
    expect(prompt).not.toContain("record from a different angle");
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
