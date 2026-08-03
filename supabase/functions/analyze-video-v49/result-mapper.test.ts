import { mapV49Result } from "./result-mapper";
import type { ProblemFinderProblem } from "./problem-finder";
import type { CoachingWriterResult } from "./coaching-writer";
import type { SetDeclaration } from "../_shared/set-declaration";
import { analysisResultSchema } from "../../../src/features/analysis/result-schema";

const declaration: SetDeclaration = { exercise: { source: "custom", catalogExerciseId: null, label: "Incline Row" }, amount: { kind: "reps", value: 8, countScope: "total" }, load: { kind: "unknown" }, side: "bilateral", styles: [], focusNote: null };
const problems: ProblemFinderProblem[] = [{ id: "rounding", observation: "The spine rounds.", evidence: [{ startMs: 100, peakMs: 200, endMs: 300, visualEvidence: "The spine visibly rounds.", confidence: 0.91 }] }];
const writing: CoachingWriterResult = {
  overallAssessment: "The Incline Row needs a firmer supported position.", coachNote: "Keep your chest connected to the pad.", score: 70,
  movementScores: [{ id: "rounding", label: "Spinal position", score: 70, observed: "One identified issue.", evidenceIds: ["rounding"] }],
  muscleFocus: { primary: [{ name: "Latissimus dorsi", region: "lats" }], secondary: [], unclassified: [] },
  corrections: [{ problemId: "rounding", title: "Spinal position", whatHappened: "The spine rounds.", whyItMatters: "It changes the supported row position.", whatToDo: "Keep a neutral spine against the incline bench.", successCheck: "Your spine stays neutral.", severity: "important", coachingArea: "form", observedIssueRegions: ["torso", "lower_back"] }],
  setSummary: { verdict: "Fix spinal position first." },
  nextSetPlan: [{ problemId: "rounding", action: "Set a neutral spine before the first Incline Row rep.", rationale: "Addresses the visible rounding.", successCheck: "The spine stays neutral." }],
};

it("copies Gemini 3.6 evidence byte-for-byte into the public correction", () => {
  const result = mapV49Result({ declaration, catalogContext: { canonicalLabel: "Incline Row", family: "row", equipment: ["dumbbell", "bench"] }, problems, writing });
  expect(result.priorityCorrections[0].evidence[0]).toMatchObject(problems[0].evidence[0]);
  expect(result.priorityCorrections[0].expandedCoaching?.whatToDo).toBe(writing.corrections[0].whatToDo);
  expect(result.didWell).toEqual([]);
  expect(result.nextSetPlan[0].relatedFindingId).toBe("rounding");
  expect(analysisResultSchema.safeParse(result).success).toBe(true);
});

it("maps an honest empty problem list without inventing a score or strength", () => {
  const empty = mapV49Result({
    declaration,
    catalogContext: { canonicalLabel: "Incline Row", family: "row", equipment: ["dumbbell", "bench"] },
    problems: [],
    writing: {
      overallAssessment: "The problem finder returned no meaningful visible problems.",
      coachNote: "No corrective coaching was generated for this Incline Row.",
      score: null,
      movementScores: [],
      muscleFocus: { primary: [{ name: "Latissimus dorsi", region: "lats" }], secondary: [], unclassified: [] },
      corrections: [],
      setSummary: { verdict: "No problem-specific correction is available." },
      nextSetPlan: [],
    },
  });

  expect(empty.score).toBeNull();
  expect(empty.didWell).toEqual([]);
  expect(empty.priorityCorrections).toEqual([]);
  expect(analysisResultSchema.safeParse(empty).success).toBe(true);
});
