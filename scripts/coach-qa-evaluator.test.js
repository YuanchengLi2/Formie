const { evaluateCoachQa } = require("./coach-qa-evaluator.cjs");

function manifest() {
  return { cases: Array.from({ length: 20 }, (_, index) => ({ id: `case-${index + 1}`, expectedTimestampMs: index < 10 ? 5_000 : null })) };
}

function passingResults() {
  return manifest().cases.map((fixture) => ({
    id: fixture.id,
    status: "complete",
    grounding: { scope: "focused_window", startMs: 3_000, endMs: 8_000, citations: fixture.expectedTimestampMs === null ? [] : [{ timeMs: 5_200, label: "Visible event" }] },
    review: { correct: true, unsupportedClaims: [] },
  }));
}

describe("coach QA benchmark evaluator", () => {
  it("passes only when every release gate is met", () => {
    const report = evaluateCoachQa(manifest(), passingResults());
    expect(report.metrics).toMatchObject({ completed: 20, humanCorrect: 20, unsupportedClaimCount: 0, citationValidityRate: 1, localizationAccuracy: 1 });
    expect(report.passed).toBe(true);
  });

  it("fails completion, agreement, localization, unsupported-claim, and citation gates", () => {
    const results = passingResults();
    results[0].status = "failed";
    results[1].review.correct = false;
    results[5].review.correct = false;
    results[6].review.correct = false;
    results[7].review.correct = false;
    results[2].review.unsupportedClaims = ["Invented knee position"];
    results[3].grounding.citations = [{ timeMs: 9_000, label: "Outside" }];
    results[4].grounding.citations = [{ timeMs: 7_000, label: "Too late" }];
    const report = evaluateCoachQa(manifest(), results);
    expect(report.passed).toBe(false);
    expect(report.failures.map((failure) => failure.gate)).toEqual(expect.arrayContaining(["completion", "humanAgreement", "localization", "unsupportedClaims", "citationValidity"]));
  });

  it("requires an explicit human review instead of treating fluent text as correct", () => {
    const results = passingResults();
    delete results[0].review;
    const report = evaluateCoachQa(manifest(), results);
    expect(report.metrics.reviewed).toBe(19);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(expect.objectContaining({ gate: "humanReview" }));
  });
});
