const fs = require("node:fs");

function ratio(numerator, denominator) {
  return denominator === 0 ? 1 : numerator / denominator;
}

function evaluateCoachQa(manifest, results) {
  const fixtures = Array.isArray(manifest?.cases) ? manifest.cases : [];
  const byId = new Map((Array.isArray(results) ? results : []).map((result) => [result.id, result]));
  const cases = fixtures.map((fixture) => {
    const result = byId.get(fixture.id) ?? null;
    const complete = result?.status === "complete";
    const reviewed = typeof result?.review?.correct === "boolean";
    const humanCorrect = result?.review?.correct === true;
    const unsupportedClaims = Array.isArray(result?.review?.unsupportedClaims) ? result.review.unsupportedClaims.filter(Boolean) : [];
    const grounding = result?.grounding && typeof result.grounding === "object" ? result.grounding : null;
    const citations = Array.isArray(grounding?.citations) ? grounding.citations : [];
    const validCitations = citations.filter((citation) => Number.isFinite(citation?.timeMs)
      && Number.isFinite(grounding?.startMs)
      && Number.isFinite(grounding?.endMs)
      && citation.timeMs >= grounding.startMs
      && citation.timeMs <= grounding.endMs);
    const expectedTimestampMs = Number.isFinite(fixture.expectedTimestampMs) ? fixture.expectedTimestampMs : null;
    const localized = expectedTimestampMs === null ? null : complete && citations.some((citation) => Number.isFinite(citation?.timeMs) && Math.abs(citation.timeMs - expectedTimestampMs) <= 1_000);
    return { id: fixture.id, complete, reviewed, humanCorrect, unsupportedClaims, citationCount: citations.length, validCitationCount: validCitations.length, localized };
  });

  const localizationCases = cases.filter((item) => item.localized !== null);
  const totalCitations = cases.reduce((sum, item) => sum + item.citationCount, 0);
  const validCitations = cases.reduce((sum, item) => sum + item.validCitationCount, 0);
  const metrics = {
    total: cases.length,
    completed: cases.filter((item) => item.complete).length,
    reviewed: cases.filter((item) => item.reviewed).length,
    humanCorrect: cases.filter((item) => item.humanCorrect).length,
    humanAgreementRate: ratio(cases.filter((item) => item.humanCorrect).length, cases.length),
    localizationAccuracy: ratio(localizationCases.filter((item) => item.localized).length, localizationCases.length),
    unsupportedClaimCount: cases.reduce((sum, item) => sum + item.unsupportedClaims.length, 0),
    citationValidityRate: ratio(validCitations, totalCitations),
  };

  const failures = [];
  if (metrics.total !== 20 || metrics.completed !== 20) failures.push({ gate: "completion", expected: "20/20", actual: `${metrics.completed}/${metrics.total}` });
  if (metrics.reviewed !== 20) failures.push({ gate: "humanReview", expected: "20/20", actual: `${metrics.reviewed}/20` });
  if (metrics.humanCorrect < 17) failures.push({ gate: "humanAgreement", expected: ">=17/20", actual: `${metrics.humanCorrect}/20` });
  if (metrics.localizationAccuracy < 0.85) failures.push({ gate: "localization", expected: ">=85%", actual: metrics.localizationAccuracy });
  if (metrics.unsupportedClaimCount !== 0) failures.push({ gate: "unsupportedClaims", expected: 0, actual: metrics.unsupportedClaimCount });
  if (metrics.citationValidityRate !== 1) failures.push({ gate: "citationValidity", expected: "100%", actual: metrics.citationValidityRate });
  return { metrics, cases, failures, passed: failures.length === 0 };
}

if (require.main === module) {
  const [manifestPath, resultsPath, reportPath] = process.argv.slice(2);
  if (!manifestPath || !resultsPath) throw new Error("Usage: node scripts/coach-qa-evaluator.cjs <manifest.json> <results.json> [report.json]");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const payload = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const report = { generatedAt: new Date().toISOString(), ...evaluateCoachQa(manifest, payload.results ?? payload) };
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}

module.exports = { evaluateCoachQa };
