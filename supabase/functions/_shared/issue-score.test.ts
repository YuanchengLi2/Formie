import { scoreIssues } from "./issue-score.ts";

const issue = (overrides: Partial<Parameters<typeof scoreIssues>[0][number]> = {}) => ({
  id: "issue",
  severity: "important" as const,
  prevalence: "repeated" as const,
  confidence: 1,
  ...overrides,
});

describe("authoritative issue severity scoring", () => {
  it("returns 100 when the analyst found no issues", () => {
    expect(scoreIssues([]).score).toBe(100);
  });

  it("matches the severity rubric anchor points", () => {
    expect(scoreIssues([issue({ severity: "note", prevalence: "isolated" })]).score).toBe(96);
    expect(scoreIssues([issue({ severity: "important", prevalence: "repeated" })]).score).toBe(86);
    expect(scoreIssues([issue({ severity: "high", prevalence: "throughout" })]).score).toBe(65);
  });

  it("keeps scores monotonic as issue impact grows", () => {
    const baseline = scoreIssues([issue({ severity: "note", prevalence: "isolated", confidence: 0 })]).score;
    expect(scoreIssues([issue({ severity: "important", prevalence: "isolated", confidence: 0 })]).score).toBeLessThanOrEqual(baseline);
    expect(scoreIssues([issue({ severity: "important", prevalence: "throughout", confidence: 1 })]).score).toBeLessThanOrEqual(
      scoreIssues([issue({ severity: "important", prevalence: "throughout", confidence: 0 })]).score,
    );
    expect(scoreIssues([issue({ severity: "important", prevalence: "throughout", confidence: 1 }), issue({ id: "second", severity: "note", prevalence: "isolated" })]).score).toBeLessThanOrEqual(
      scoreIssues([issue({ severity: "important", prevalence: "throughout", confidence: 1 })]).score,
    );
  });

  it("retains every distinct issue and scores the inspected production profile near 60", () => {
    const result = scoreIssues([
      issue({ id: "important-throughout", prevalence: "throughout" }),
      issue({ id: "important-repeated-a" }),
      issue({ id: "important-repeated-b" }),
      issue({ id: "note-throughout", severity: "note", prevalence: "throughout" }),
    ]);
    expect(result.issues).toHaveLength(4);
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.score).toBeLessThanOrEqual(65);
    expect(result.issues.every((detail) => detail.penalty > 0 && detail.scoringConfidence >= 0.85)).toBe(true);
  });

  it("scores the exact inspected production evidence at 57 instead of 92", () => {
    const result = scoreIssues([
      issue({ id: "important-throughout-a", prevalence: "throughout", confidence: 0.7 }),
      issue({ id: "important-throughout-b", prevalence: "throughout", confidence: 0.68 }),
      issue({ id: "important-repeated", prevalence: "repeated", confidence: 0.67 }),
      issue({ id: "note-throughout", severity: "note", prevalence: "throughout", confidence: 0.68 }),
    ]);
    expect(result.score).toBe(57);
    expect(result.issues).toHaveLength(4);
  });
});
