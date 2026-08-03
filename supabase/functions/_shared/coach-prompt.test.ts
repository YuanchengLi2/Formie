import { buildCoachAnswerPrompt, buildCoachLocatorPrompt, buildCoachPrompt, resolveCoachEvidence } from "./coach-prompt";

describe("video coach prompt", () => {
  const analysis = {
    setContext: { cameraView: "down-front", visibleReferences: ["shoulder relative to pad", "handle endpoint"], sequenceSummary: "Eight reps were visible.", changeAcrossSet: "The final two handle endpoints were shorter.", coachingBasis: "Repeat the earlier endpoint without shoulder rise." },
    priorityCorrections: [{ id: "corr_1", title: "Shoulder rise", detail: "The shoulder rises near lockout.", evidence: [{ peakMs: 1300, repNumber: 8, phase: "top", visualEvidence: "The shoulder lifts above its earlier position." }] }],
  };

  it("resolves selected evidence from the immutable analysis", () => {
    expect(resolveCoachEvidence(analysis, { findingId: "corr_1", peakMs: 1300 })).toEqual({ findingId: "corr_1", title: "Shoulder rise", detail: "The shoulder rises near lockout.", peakMs: 1300, repNumber: 8, phase: "top", visualEvidence: "The shoulder lifts above its earlier position." });
    expect(() => resolveCoachEvidence(analysis, { findingId: "corr_1", peakMs: 99 })).toThrow(/selected evidence is unavailable/i);
  });

  it("grounds replies in analysis, timestamps, intent, and explicit safety limits", () => {
    const prompt = buildCoachPrompt({
      analysis,
      selectedEvidence: resolveCoachEvidence(analysis, { findingId: "corr_1", peakMs: 1300 }),
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
    expect(prompt).toContain("Selected evidence focus");
    expect(prompt).toContain("Shoulder rise");
    expect(prompt).toContain("Lead with a direct answer");
    expect(prompt).toContain("Finish with one practical next-set action");
  });

  it("builds locator and answer prompts without duplicating the current question", () => {
    const history = [{ id: "11111111-1111-4111-8111-111111111111", threadId: "22222222-2222-4222-8222-222222222222", role: "assistant" as const, content: "Earlier answer", createdAt: "now" }];
    const question = "What happened during rep four?";
    const locator = buildCoachLocatorPrompt({ analysis, selectedEvidence: null, targetIntent: null, history, message: question, durationMs: 20_000 });
    const answer = buildCoachAnswerPrompt({ analysis, targetIntent: null, history, message: question, durationMs: 20_000, location: { scope: "focused_window", startMs: 3_500, endMs: 9_500, rationale: "Rep four", clarification: null } });
    expect(locator.match(new RegExp(question.replace(/[?]/g, "\\?"), "g"))).toHaveLength(1);
    expect(answer.match(new RegExp(question.replace(/[?]/g, "\\?"), "g"))).toHaveLength(1);
    expect(locator).toContain("Return focused_window");
    expect(locator).toContain("whole_set: startMs and endMs MUST both be null");
    expect(answer).toContain("offsetMs relative to the beginning of the supplied reviewed media");
    expect(answer).toContain("offsetMs 0 is the first frame");
    expect(answer).toContain("Reviewed media duration in milliseconds: 6000");
    expect(answer).not.toContain('"startMs":3500');
    expect(answer).not.toContain('"endMs":9500');
    expect(answer).toContain("may make a new visible observation");
    expect(answer).toContain("Never change or recalculate the saved score");
    expect(answer).toContain("return no observation citations and no next-set action");
    expect(answer).toContain("Do not explain a visible compensation by naming which muscle took over");
  });
});
