import { buildCoachingWriterPrompt, parseCoachingWriterResult, type CoachingWriterResult } from "./coaching-writer";
import type { ProblemFinderProblem } from "./problem-finder";
import type { SetDeclaration } from "../_shared/set-declaration";

const declaration: SetDeclaration = {
  exercise: { source: "catalog", catalogExerciseId: 14, label: "Chest-Supported Row" },
  amount: { kind: "reps", value: 10, countScope: "total" },
  load: { kind: "known", value: 30, unit: "lb", scope: "per_hand" },
  side: "bilateral",
  styles: [],
  focusNote: null,
};
const problems: ProblemFinderProblem[] = [
  { id: "spine", observation: "The thoracic and lumbar spine round against the pad.", evidence: [{ startMs: 100, peakMs: 200, endMs: 300, visualEvidence: "The spine rounds.", confidence: 0.9 }] },
  { id: "pull", observation: "The dumbbells travel toward the hips instead of upward.", evidence: [{ startMs: 400, peakMs: 500, endMs: 600, visualEvidence: "The dumbbells finish by the hips.", confidence: 0.9 }] },
];

function validWriterResult(): CoachingWriterResult {
  return {
    overallAssessment: "Your Chest-Supported Row needs a more upward pull and a firmer position on the bench.",
    coachNote: "On the next Chest-Supported Row set, keep your chest supported while driving the elbows upward.",
    movementScores: problems.map((problem, index) => ({ id: problem.id, label: index === 0 ? "Spinal position" : "Pull direction", score: 60 + index, observed: problem.observation, evidenceIds: [problem.id] })),
    muscleFocus: { primary: [{ name: "Latissimus dorsi", region: "lats" }], secondary: [{ name: "Rear deltoids", region: "rear_shoulders" }], unclassified: [] },
    corrections: problems.map((problem, index) => ({
      problemId: problem.id,
      title: index === 0 ? "Spinal position" : "Pull direction",
      whatHappened: problem.observation,
      whyItMatters: "This changes how the Chest-Supported Row is performed.",
      whatToDo: index === 0 ? "Keep your chest connected to the bench and hold a neutral thoracic and lumbar position." : "On each Chest-Supported Row rep, drive your elbows upward instead of pulling the dumbbells toward your hips.",
      successCheck: index === 0 ? "Your spine stays neutral against the pad." : "The dumbbells rise beside the bench rather than traveling toward your hips.",
      severity: "important",
      coachingArea: "form",
      observedIssueRegions: index === 0 ? ["torso", "lower_back"] : ["upper_back", "upper_arms"],
    })),
    setSummary: { verdict: "Prioritize position and pull direction." },
    nextSetPlan: problems.map((problem, index) => ({ problemId: problem.id, action: index === 0 ? "Set your Chest-Supported Row position against the pad before the first rep." : "Drive the elbows upward on every Chest-Supported Row rep.", rationale: "Addresses the identified problem.", successCheck: "The corrected pattern is visible." })),
  };
}

describe("v49 coaching writer", () => {
  it("receives the exact exercise and immutable visual problems", () => {
    const prompt = buildCoachingWriterPrompt({ declaration, catalogContext: { canonicalLabel: "Chest-Supported Row", family: "row", equipment: ["dumbbells", "incline bench"] }, problems });
    expect(prompt).toContain("Chest-Supported Row");
    expect(prompt).toContain("thoracic and lumbar spine");
    expect(prompt).toContain("must not add, remove, merge, split, rename, contradict, or reorder");
    expect(prompt).toContain("must not invent positive visible facts");
    expect(prompt).toContain("one issue score for each of the first four immutable problems");
    expect(prompt).toContain('Every whatToDo, successCheck, and nextSetPlan action must literally name "Chest-Supported Row"');
    expect(prompt).toContain("plain text only");
    expect(prompt).toContain("whatToDo must be exactly one complete actionable sentence");
    expect(prompt).toContain("The app renders whatToDo in bold");
    expect(prompt).not.toMatch(/forbid.*cervical|banned words|imperative/i);
  });

  it("requires proportional coaching without unsupported biomechanical or safety claims", () => {
    const prompt = buildCoachingWriterPrompt({ declaration, catalogContext: { canonicalLabel: "Chest-Supported Row", family: "row", equipment: ["dumbbells", "incline bench"] }, problems });

    expect(prompt).toContain("least aggressive cue that directly corrects the observation");
    expect(prompt).toContain("Do not prescribe an extreme or absolute joint position");
    expect(prompt).toContain("Do not claim that a correction prevents injury, maximizes muscle recruitment, or transfers stress");
    expect(prompt).toContain("Success checks must be visible, testable, and proportional to the immutable observation");
    expect(prompt).toContain('Every nextSetPlan.action must begin with "For your Chest-Supported Row,"');
    expect(prompt).toContain("Do not return fragmentary next-set actions");
  });

  it("preserves exercise-specific and anatomical language without rewriting it", () => {
    const parsed = parseCoachingWriterResult(validWriterResult(), problems);
    expect(parsed.corrections[0].whatToDo).toContain("thoracic and lumbar");
    expect(parsed.corrections[1].whatToDo).toContain("Chest-Supported Row");
  });

  it("removes Markdown markers from model copy before it reaches the app", () => {
    const markedUp = validWriterResult();
    markedUp.corrections[0].whatToDo = "**Keep your thoracic and lumbar spine steady during the Chest-Supported Row.**";
    markedUp.corrections[0].whyItMatters = "*This keeps the observed pull easier to repeat.*";
    const parsed = parseCoachingWriterResult(markedUp, problems);
    expect(parsed.corrections[0].whatToDo).toBe("Keep your thoracic and lumbar spine steady during the Chest-Supported Row.");
    expect(parsed.corrections[0].whyItMatters).toBe("This keeps the observed pull easier to repeat.");
  });

  it("rejects a multi-sentence what-to-do instruction", () => {
    const verbose = validWriterResult();
    verbose.corrections[0].whatToDo = "Set your Chest-Supported Row position against the pad. Then keep your spine steady.";
    expect(() => parseCoachingWriterResult(verbose, problems)).toThrow(/exactly one sentence/i);
  });

  it("returns only issue-derived scores and no score when no problem was discovered", () => {
    const parsed = parseCoachingWriterResult(validWriterResult(), problems);
    expect(parsed.score).toBe(60.5);
    expect(parsed.movementScores.map((score) => ({ id: score.id, evidenceIds: score.evidenceIds }))).toEqual([
      { id: "spine", evidenceIds: ["spine"] },
      { id: "pull", evidenceIds: ["pull"] },
    ]);

    const empty = validWriterResult();
    empty.movementScores = [];
    empty.corrections = [];
    empty.nextSetPlan = [];
    const parsedEmpty = parseCoachingWriterResult(empty, []);
    expect(parsedEmpty.score).toBeNull();
    expect(parsedEmpty.movementScores).toEqual([]);
  });

  it.each([
    ["missing", () => ({ ...validWriterResult(), corrections: validWriterResult().corrections.slice(0, 1) })],
    ["extra", () => ({ ...validWriterResult(), corrections: [...validWriterResult().corrections, { ...validWriterResult().corrections[0], problemId: "invented" }] })],
    ["reordered", () => ({ ...validWriterResult(), corrections: [...validWriterResult().corrections].reverse() })],
  ])("rejects %s problem IDs instead of falling back to generic coaching", (_name, value) => {
    expect(() => parseCoachingWriterResult(value(), problems)).toThrow(/problem ids/i);
  });

  it("rejects writer output that cannot satisfy the public result shape", () => {
    const emptyRegions = validWriterResult();
    emptyRegions.corrections[0].observedIssueRegions = [];
    expect(() => parseCoachingWriterResult(emptyRegions, problems)).toThrow(/observedIssueRegions/);
    const repeatedScore = validWriterResult();
    repeatedScore.movementScores[1].label = repeatedScore.movementScores[0].label;
    expect(() => parseCoachingWriterResult(repeatedScore, problems)).toThrow(/unique/);
    const uncitedScore = validWriterResult();
    uncitedScore.movementScores[0].evidenceIds = [];
    expect(() => parseCoachingWriterResult(uncitedScore, problems)).toThrow(/exactly its matching immutable problem/);
    const extraScore = validWriterResult();
    extraScore.movementScores.push({ id: "invented", label: "Invented", score: 90, observed: "Invented positive fact.", evidenceIds: ["spine"] });
    expect(() => parseCoachingWriterResult(extraScore, problems)).toThrow(/first four immutable problems/);
  });

  it("normalizes repeated muscle-map regions without discarding otherwise valid coaching", () => {
    const repeated = validWriterResult();
    repeated.muscleFocus.primary.push({ name: "Second lat label", region: "lats" });
    repeated.muscleFocus.secondary.push({ name: "Supporting lat label", region: "lats" });
    repeated.muscleFocus.unclassified = ["Rotator cuff", "Rotator cuff"];

    expect(parseCoachingWriterResult(repeated, problems).muscleFocus).toEqual({
      primary: [{ name: "Latissimus dorsi", region: "lats" }],
      secondary: [{ name: "Rear deltoids", region: "rear_shoulders" }],
      unclassified: ["Rotator cuff"],
    });
  });
});
