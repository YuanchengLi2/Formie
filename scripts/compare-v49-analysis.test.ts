import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildProblemFinderPrompt } from "../supabase/functions/analyze-video-v49/problem-finder";
import { mapV49Result } from "../supabase/functions/analyze-video-v49/result-mapper";
import { evaluateV49Comparison, expectedConceptsForSession, type ComparisonFixture } from "./compare-v49-analysis";

const fixture = JSON.parse(readFileSync(resolve(__dirname, "fixtures/v49-quality-benchmark.json"), "utf8")) as ComparisonFixture;
const declaration = { exercise: { source: "custom" as const, catalogExerciseId: null, label: "Incline chest-supported row" }, amount: { kind: "reps" as const, value: 8, countScope: "total" as const }, load: { kind: "known" as const, value: 30, unit: "lb" as const, scope: "per_hand" as const }, side: "bilateral" as const, styles: [], focusNote: null };
const v49Telemetry = [
  { model: "gemini-3.6-flash" },
  { model: "gemini-3.1-flash-lite" },
];

describe("v49 shadow quality comparison", () => {
  it("never applies one exercise's benchmark concepts to another session", () => {
    expect(expectedConceptsForSession(fixture, fixture.benchmarks[0].sessionId)).toEqual(fixture.benchmarks[0].expectedConcepts);
    expect(expectedConceptsForSession(fixture, "unbenchmarked-squat-session")).toEqual([]);
  });

  it("keeps benchmark expectations out of the problem-finder prompt", () => {
    const prompt = buildProblemFinderPrompt(15_000, declaration).toLocaleLowerCase();
    for (const concept of fixture.benchmarks[0].expectedConcepts) {
      for (const term of concept.terms) expect(prompt).not.toContain(term.toLocaleLowerCase());
    }
  });

  it("reports coverage, unrelated findings, specificity, call counts, schema parsing, and generic fallbacks", () => {
    const problems = fixture.benchmarks[0].expectedConcepts.map((concept, index) => ({ id: concept.id, observation: concept.terms[0], evidence: [{ startMs: index * 1000, peakMs: index * 1000 + 100, endMs: index * 1000 + 200, visualEvidence: concept.label, confidence: 0.9 }] }));
    const publicResult = mapV49Result({
      declaration,
      catalogContext: { canonicalLabel: "Incline chest-supported row", family: "row", equipment: ["bench", "dumbbells"] },
      problems,
      writing: {
        overallAssessment: "Three visible problems need attention.", coachNote: "Adjust the incline chest-supported row.", score: 60,
        movementScores: problems.slice(0, 4).map((problem) => ({ id: problem.id, label: problem.observation, score: 60, observed: problem.observation, evidenceIds: [problem.id] })),
        muscleFocus: { primary: [], secondary: [], unclassified: [] },
        corrections: problems.map((problem) => ({ problemId: problem.id, title: problem.observation, whatHappened: problem.observation, whyItMatters: "It changes the intended row pattern.", whatToDo: "Use the incline row bench and dumbbells to correct this direction.", successCheck: "The incline row follows the corrected direction.", severity: "important", coachingArea: "form", observedIssueRegions: ["torso"] })),
        setSummary: { verdict: "Needs adjustment." },
        nextSetPlan: problems.map((problem) => ({ problemId: problem.id, action: "Adjust the incline row bench on the next set.", rationale: "Correct the listed problem.", successCheck: "The incline row follows the corrected direction." })),
      },
    });
    const report = evaluateV49Comparison({ oldResult: { priority_corrections: [{ id: "old" }] }, problemOutput: { status: "complete", unableReason: null, problems }, publicResult, expectedConcepts: fixture.benchmarks[0].expectedConcepts, genericFallbackPatterns: fixture.genericFallbackPatterns, telemetry: v49Telemetry });
    expect(report.missingConcepts).toEqual([]);
    expect(report.unrelatedFindings).toEqual([]);
    expect(report.specificity.every((item) => item.whatToDoNamesExerciseOrEquipment && item.nextSetNamesExerciseOrEquipment)).toBe(true);
    expect(report.callCounts).toEqual({ problemFinder: 1, coachingWriter: 1 });
    expect(report.clientSchemaIssues).toEqual([]);
    expect(report.clientSchemaValid).toBe(true);
    expect(report.genericFallbacks).toEqual([]);
  });

  it("keeps discovered problems and call counts visible when the writer stage fails", () => {
    const problems = [{
      id: "range",
      observation: "Incomplete range of motion",
      evidence: [{ startMs: 100, peakMs: 200, endMs: 300, visualEvidence: "The elbow stays bent.", confidence: 0.8 }],
    }];
    const report = evaluateV49Comparison({
      oldResult: null,
      problemOutput: { status: "complete", unableReason: null, problems },
      publicResult: null,
      expectedConcepts: fixture.benchmarks[0].expectedConcepts,
      genericFallbackPatterns: fixture.genericFallbackPatterns,
      telemetry: v49Telemetry,
    });

    expect(report.v49Issues).toEqual(problems);
    expect(report.callCounts).toEqual({ problemFinder: 1, coachingWriter: 1 });
    expect(report.clientSchemaValid).toBe(false);
  });
});
