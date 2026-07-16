import { buildCoachPrompt } from "./coach-prompt";

describe("video coach prompt", () => {
  it("grounds replies in analysis, timestamps, intent, and explicit safety limits", () => {
    const prompt = buildCoachPrompt({
      analysis: { priorityCorrections: [{ title: "Shoulder rise", evidence: [{ peakMs: 1300 }] }] },
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
  });
});
