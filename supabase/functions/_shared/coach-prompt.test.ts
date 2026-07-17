import { buildCoachPrompt } from "./coach-prompt";

describe("video coach prompt", () => {
  it("grounds replies in analysis, timestamps, intent, and explicit safety limits", () => {
    const prompt = buildCoachPrompt({
      analysis: {
        setContext: { cameraView: "down-front", visibleReferences: ["shoulder relative to pad", "handle endpoint"], sequenceSummary: "Eight reps were visible.", changeAcrossSet: "The final two handle endpoints were shorter.", coachingBasis: "Repeat the earlier endpoint without shoulder rise." },
        repTimeline: [{ repNumber: 1, assessment: "consistent" }, { repNumber: 8, assessment: "breakdown" }],
        priorityCorrections: [{ title: "Shoulder rise", evidence: [{ peakMs: 1300 }] }],
      },
      targetIntent: "upper back",
      history: [],
      message: "Did this hit my lats?",
    });
    expect(prompt).toContain("Selected analysis");
    expect(prompt).toContain("1300");
    expect(prompt).toContain("upper back");
    expect(prompt).toContain("never claim measured muscle activation");
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("Never invent visibility");
    expect(prompt).toContain("Use the selected recording as one continuous set");
    expect(prompt).toContain("distinguish an isolated event from a set-wide pattern");
    expect(prompt).toContain("same phase across repetitions");
    expect(prompt).toContain("relative-depth cues");
    expect(prompt).toContain("Never invent metric 3D depth");
    expect(prompt).toContain("The final two handle endpoints were shorter.");
  });
});
