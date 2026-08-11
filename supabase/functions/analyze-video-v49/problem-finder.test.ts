import { buildProblemFinderPrompt, parseProblemFinderResult, PROBLEM_FINDER_SCHEMA } from "./problem-finder";
import type { SetDeclaration } from "../_shared/set-declaration";

const declaration: SetDeclaration = {
  exercise: { source: "catalog", catalogExerciseId: 14, label: "Chest-Supported Row" },
  amount: { kind: "reps", value: 10, countScope: "total" },
  load: { kind: "known", value: 30, unit: "lb", scope: "per_hand" },
  side: "bilateral",
  styles: [],
  focusNote: null,
};

describe("v49 problem finder", () => {
  it("requires at least four genuine issues and permits more", () => {
    const prompt = buildProblemFinderPrompt(9_133, declaration);

    expect(prompt).toContain("Chest-Supported Row");
    expect(prompt).toContain("identify visible problems");
    expect(prompt).toContain("Do not stop after the first obvious problem");
    expect(prompt).toContain("Return at least four distinct genuine visible problems");
    expect(prompt).toContain("Continue beyond four when more genuine problems are visible");
    expect(prompt).toContain("Four is a minimum, never a stopping target");
    expect(prompt).toContain("not a target or a claim about what occurred");
    expect(prompt).toContain("do not judge whether");
    expect(prompt).toContain("Do not omit a visible problem because it is subtle");
    expect(prompt).toContain("equipment setup and body-to-equipment contact");
    expect(prompt).toContain("posture and joint alignment");
    expect(prompt).toContain("movement and equipment path");
    expect(prompt).toContain("beginning, middle, and end");
    expect(prompt).toContain("inspection directions, not required output categories");
    expect(prompt).toContain("return unable with insufficient_visual_evidence rather than padding");
    expect(prompt.split(/\s+/).length).toBeLessThan(300);
    expect(prompt).not.toMatch(/small|familiar|acceptable|conservative|improvement counts/i);
  });

  it("sends Gemini a four-item minimum only for complete results, with no maximum", () => {
    const complete = PROBLEM_FINDER_SCHEMA.anyOf.find((branch) => branch.properties.status.enum[0] === "complete");
    const unable = PROBLEM_FINDER_SCHEMA.anyOf.find((branch) => branch.properties.status.enum[0] === "unable");
    expect(complete?.properties.problems.minItems).toBe(4);
    expect(complete?.properties.problems).not.toHaveProperty("maxItems");
    expect(unable?.properties.problems.maxItems).toBe(0);
  });

  it.each([4, 5])("accepts %i grounded problems", (count) => {
    const grounded = [
      ["Torso lifts away from the support pad during the pull", "The chest separates from the support pad near the top."],
      ["Right elbow travels higher than the left elbow near the top", "The right elbow finishes visibly above the left elbow."],
      ["Dumbbells accelerate through the final third of the lowering phase", "The weights descend faster just before the arms straighten."],
      ["Wrists bend inward as the handles approach the torso", "Both wrists lose their straight alignment beside the torso."],
      ["Feet shift between repetitions and narrow the support base", "The right foot moves inward before the final repetition."],
    ];
    const result = parseProblemFinderResult({
      status: "complete",
      unableReason: null,
      problems: Array.from({ length: count }, (_, index) => ({
        id: `problem-${index + 1}`,
        observation: grounded[index][0],
        evidence: [{ startMs: 100, peakMs: 200, endMs: 300, visualEvidence: grounded[index][1], confidence: 0.9 }],
      })),
    }, 1_000);

    expect(result.status).toBe("complete");
    if (result.status === "complete") expect(result.problems).toHaveLength(count);
  });

  it.each([0, 1, 3])("rejects a complete result with only %i problems", (count) => {
    expect(() => parseProblemFinderResult({
      status: "complete",
      unableReason: null,
      problems: Array.from({ length: count }, (_, index) => ({
        id: `problem-${index + 1}`,
        observation: `Visible problem ${index + 1}`,
        evidence: [{ startMs: 100, peakMs: 200, endMs: 300, visualEvidence: "The issue is visible.", confidence: 0.9 }],
      })),
    }, 1_000)).toThrow(/at least four/i);
  });

  it("keeps evidence attached to its problem and rejects duplicate IDs", () => {
    expect(() => parseProblemFinderResult({
      status: "complete",
      unableReason: null,
      problems: Array.from({ length: 4 }, () => ({
        id: "same-id",
        observation: "The right elbow rises above the left elbow at the top.",
        evidence: [{ startMs: 0, peakMs: 50, endMs: 100, visualEvidence: "The right elbow finishes visibly above the left elbow.", confidence: 0.8 }],
      })),
    }, 1_000)).toThrow(/duplicate/i);
  });

  it("rejects duplicate observations even when the model changes their IDs and punctuation", () => {
    const observations = [
      "The right elbow rises above the left elbow at the top.",
      "The right elbow rises above the left elbow at the top!",
      "The torso lifts away from the support pad during the pull.",
      "The wrists bend inward as the handles approach the torso.",
    ];
    expect(() => parseProblemFinderResult({
      status: "complete",
      unableReason: null,
      problems: observations.map((observation, index) => ({
        id: `problem-${index + 1}`,
        observation,
        evidence: [{ startMs: 100, peakMs: 200, endMs: 300, visualEvidence: `Visible body and equipment relationship for observation ${index + 1}.`, confidence: 0.9 }],
      })),
    }, 1_000)).toThrow(/duplicate problem observation/i);
  });

  it("rejects generic filler instead of counting it toward the four-problem minimum", () => {
    expect(() => parseProblemFinderResult({
      status: "complete",
      unableReason: null,
      problems: Array.from({ length: 4 }, (_, index) => ({
        id: `problem-${index + 1}`,
        observation: `Visible problem number ${index + 1}`,
        evidence: [{ startMs: 100, peakMs: 200, endMs: 300, visualEvidence: "The issue is visible in the recording.", confidence: 0.9 }],
      })),
    }, 1_000)).toThrow(/substantive/i);
  });

  it("accepts an honest unable response with no problems", () => {
    expect(parseProblemFinderResult({
      status: "unable",
      unableReason: { code: "movement_not_visible", message: "The movement is outside the frame." },
      problems: [],
    }, 1_000)).toEqual({
      status: "unable",
      unableReason: { code: "movement_not_visible", message: "The movement is outside the frame." },
      problems: [],
    });
  });

});
