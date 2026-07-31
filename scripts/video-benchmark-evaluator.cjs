const fs = require("node:fs");

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : null;
}

function averageNumbers(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function percentile(values, quantile) {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;
  return finite[Math.max(0, Math.ceil(quantile * finite.length) - 1)];
}

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function recognitionMatches(fixture, output) {
  const label = normalize(output.recognition?.label);
  if (!label) return false;
  const accepted = [fixture.expectedExercise, ...(fixture.acceptedLabels ?? [])].map(normalize).filter(Boolean);
  return accepted.some((candidate) => label.includes(candidate) || candidate.includes(label));
}

function cameraViewMatches(expectedView, actualView) {
  const expected = normalize(expectedView);
  const actual = normalize(actualView);
  if (!expected || !actual) return false;
  if (expected.includes("diagonal") || expected.includes("45")) return actual.includes("45") || actual.includes("diagonal");
  if (expected.includes("front")) return actual === "front";
  if (expected.includes("rear") || expected.includes("back")) return actual === "rear" || actual === "back";
  if (expected.includes("side")) return actual === "side";
  return expected === actual;
}

function scoreBandMatches(fixture, output) {
  if (!Number.isFinite(output.score)) return false;
  return fixture.expectedQuality === "good" ? output.score >= 75 : fixture.expectedQuality === "bad" ? output.score <= 74 : true;
}

function significantCorrections(output) {
  return (output.priorityCorrections ?? []).filter((finding) => ["important", "high"].includes(finding.severity));
}

function hasBadSignal(output) {
  return significantCorrections(output).length > 0 || (Number.isFinite(output.score) && output.score <= 74);
}

function hasUnsafeLoadClaim(fixture, output) {
  if (fixture.expectedLoad !== "unreadable") return false;
  return (output.equipmentObservations ?? []).some((observation) => observation.load && (observation.load.certainty === "exact_visible" || Number.isFinite(observation.load.value)));
}

function allEvidence(output) {
  if (Array.isArray(output.evidenceTiming)) return output.evidenceTiming;
  const findings = [...(output.priorityCorrections ?? []), ...(output.coachingCues ?? []), ...(output.didWell ?? [])];
  return findings.flatMap((finding) => finding.evidence ?? []);
}

function evidenceIntervalIsValid(item) {
  const startMs = Number(item?.startMs);
  const peakMs = Number(item?.peakMs ?? item?.startMs);
  const endMs = Number(item?.endMs);
  return Number.isFinite(startMs) && Number.isFinite(peakMs) && Number.isFinite(endMs)
    && startMs >= 0 && endMs > startMs && startMs <= peakMs && peakMs <= endMs;
}

function modelCallFailed(output) {
  if (output.failureCode) return true;
  return (output.telemetry ?? []).some((call) => String(call.status).toLowerCase() === "failed" || Boolean(call.error_code ?? call.errorCode));
}

function evaluateThresholds(metrics, thresholds = {}) {
  const checks = Object.entries(thresholds).map(([thresholdKey, threshold]) => {
    const maximum = thresholdKey.endsWith("Max");
    const metricKey = maximum ? thresholdKey.slice(0, -3) : thresholdKey;
    const actual = metrics[metricKey];
    const passed = Number.isFinite(actual) && (maximum ? actual <= threshold : actual >= threshold);
    return { thresholdKey, metricKey, actual: Number.isFinite(actual) ? actual : null, threshold, comparison: maximum ? "max" : "min", passed };
  });
  return {
    passed: checks.every((check) => check.passed),
    failures: checks.filter((check) => !check.passed).map((check) => `${check.metricKey} was ${check.actual ?? "missing"}; required ${check.comparison} ${check.threshold}`),
    checks,
  };
}

function evaluateBenchmark(fixtures, outputs) {
  const byId = new Map(outputs.map((output) => [output.id, output]));
  const cases = fixtures.map((fixture) => {
    const output = byId.get(fixture.id) ?? null;
    const terminal = output !== null && ["complete", "partial", "unable", "failed"].includes(output.status);
    const schemaValid = output?.clientSchemaValid === true;
    const complete = output !== null && ["complete", "partial"].includes(output.status) && schemaValid;
    const significant = output ? significantCorrections(output) : [];
    const correctionCount = output ? (output.priorityCorrections ?? []).length : 0;
    const actionableCoaching = complete && (correctionCount > 0 || (output?.nextSetPlan ?? []).length > 0);
    const equipmentExpected = (fixture.expectedEquipment ?? []).length > 0;
    const evidence = output ? allEvidence(output) : [];
    const boundaryCount = output ? Number(output.boundaryEvidenceCount ?? evidence.filter((item) => item.atBoundary).length) : 0;
    const evidenceIntervalsValid = complete && evidence.every(evidenceIntervalIsValid);
    const expectedRepCount = Number.isInteger(fixture.expectedRepCount) ? fixture.expectedRepCount : null;
    const actualRepCount = Number.isInteger(output?.setSummary?.totalReps) ? output.setSummary.totalReps : null;
    const repCountError = expectedRepCount !== null && actualRepCount !== null ? Math.abs(actualRepCount - expectedRepCount) : null;
    const repCountTolerance = Number.isInteger(fixture.repCountTolerance) ? fixture.repCountTolerance : 1;
    const expectedCameraView = fixture.expectedView ?? null;
    const actualCameraView = output?.cameraGeometry?.view ?? null;
    const cameraViewPassed = expectedCameraView === null ? null : complete && cameraViewMatches(expectedCameraView, actualCameraView);
    return {
      id: fixture.id,
      pairId: fixture.pairId ?? null,
      expectedQuality: fixture.expectedQuality,
      terminal,
      schemaValid,
      complete,
      recognized: complete && recognitionMatches(fixture, output),
      score: output?.score ?? null,
      scoreBandPassed: complete && scoreBandMatches(fixture, output),
      significantCorrectionCount: significant.length,
      correctionCount,
      actionableCoaching,
      goodFalsePositive: fixture.expectedQuality === "good" && significant.length > 0,
      badSignalDetected: fixture.expectedQuality === "bad" && output !== null && hasBadSignal(output),
      equipmentObservationPresent: equipmentExpected && (output?.equipmentObservations ?? []).length > 0,
      unsafeExactLoadClaim: output !== null && hasUnsafeLoadClaim(fixture, output),
      evidenceCount: evidence.length,
      boundaryEvidenceCount: boundaryCount,
      evidenceIntervalsValid,
      expectedCameraView,
      actualCameraView,
      cameraViewPassed,
      expectedRepCount,
      actualRepCount,
      repCountError,
      repCountPassed: repCountError === null ? null : repCountError <= repCountTolerance,
      modelFailed: output !== null && modelCallFailed(output),
      elapsedMs: Number.isFinite(output?.elapsedMs) ? output.elapsedMs : null,
    };
  });

  const pairs = [...new Set(fixtures.map((fixture) => fixture.pairId).filter(Boolean))].map((pairId) => {
    const pairCases = cases.filter((item) => item.pairId === pairId);
    const good = pairCases.find((item) => item.expectedQuality === "good");
    const bad = pairCases.find((item) => item.expectedQuality === "bad");
    const scoreGap = good && bad && Number.isFinite(good.score) && Number.isFinite(bad.score) ? good.score - bad.score : null;
    return { pairId, goodScore: good?.score ?? null, badScore: bad?.score ?? null, scoreGap, passed: scoreGap !== null && scoreGap >= 5 };
  });

  const goodCases = cases.filter((item) => item.expectedQuality === "good");
  const badCases = cases.filter((item) => item.expectedQuality === "bad");
  const loadCases = cases.filter((item) => fixtures.find((fixture) => fixture.id === item.id)?.expectedLoad === "unreadable");
  const equipmentCases = cases.filter((item) => (fixtures.find((fixture) => fixture.id === item.id)?.expectedEquipment ?? []).length > 0);
  const totalEvidence = cases.reduce((sum, item) => sum + item.evidenceCount, 0);
  const boundaryEvidence = cases.reduce((sum, item) => sum + item.boundaryEvidenceCount, 0);
  const terminalCases = cases.filter((item) => item.terminal);
  const completedCases = cases.filter((item) => item.complete);
  const repCountCases = cases.filter((item) => item.repCountError !== null);
  const cameraViewCases = cases.filter((item) => item.expectedCameraView !== null);
  const exerciseKeys = [...new Set(fixtures.map((fixture) => normalize(fixture.expectedExercise)).filter(Boolean))];
  const exercisesWithCorrections = exerciseKeys.filter((exerciseKey) => fixtures.some((fixture) =>
    normalize(fixture.expectedExercise) === exerciseKey
      && (byId.get(fixture.id)?.priorityCorrections ?? []).length > 0
  ));
  const latencyValues = cases.map((item) => item.elapsedMs).filter(Number.isFinite);
  const average = (items) => {
    const scores = items.map((item) => item.score).filter(Number.isFinite);
    return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  };

  return {
    metrics: {
      caseCount: cases.length,
      completionRate: ratio(cases.filter((item) => item.complete).length, cases.length),
      clientSchemaValidityRate: ratio(terminalCases.filter((item) => item.schemaValid).length, terminalCases.length),
      recognitionAccuracy: ratio(cases.filter((item) => item.recognized).length, cases.length),
      scoreBandAccuracy: ratio(cases.filter((item) => item.scoreBandPassed).length, cases.length),
      goodFalsePositiveRate: ratio(goodCases.filter((item) => item.goodFalsePositive).length, goodCases.length),
      badSignalRecall: ratio(badCases.filter((item) => item.badSignalDetected).length, badCases.length),
      badCorrectionRecall: ratio(badCases.filter((item) => item.correctionCount > 0).length, badCases.length),
      exerciseCorrectionCoverage: ratio(exercisesWithCorrections.length, exerciseKeys.length),
      actionableCoachingCoverage: ratio(completedCases.filter((item) => item.actionableCoaching).length, completedCases.length),
      pairwiseRankingAccuracy: ratio(pairs.filter((pair) => pair.passed).length, pairs.length),
      averageGoodScore: average(goodCases),
      averageBadScore: average(badCases),
      averageScoreSeparation: average(goodCases) !== null && average(badCases) !== null ? average(goodCases) - average(badCases) : null,
      equipmentObservationCoverage: ratio(equipmentCases.filter((item) => item.equipmentObservationPresent).length, equipmentCases.length),
      unsafeExactLoadClaimRate: ratio(loadCases.filter((item) => item.unsafeExactLoadClaim).length, loadCases.length),
      evidenceBoundaryRate: ratio(boundaryEvidence, totalEvidence),
      evidenceIntervalValidityRate: ratio(completedCases.filter((item) => item.evidenceIntervalsValid).length, completedCases.length),
      cameraViewAccuracy: ratio(cameraViewCases.filter((item) => item.cameraViewPassed).length, cameraViewCases.length),
      repCountWithinToleranceRate: ratio(repCountCases.filter((item) => item.repCountPassed).length, repCountCases.length),
      meanAbsoluteRepCountError: averageNumbers(repCountCases.map((item) => item.repCountError)),
      modelFailureRate: ratio(cases.filter((item) => item.modelFailed).length, cases.length),
      averageLatencyMs: averageNumbers(latencyValues),
      p50LatencyMs: percentile(latencyValues, 0.5),
      p95LatencyMs: percentile(latencyValues, 0.95),
    },
    pairs,
    cases,
  };
}

module.exports = { evaluateBenchmark, evaluateThresholds };

if (require.main === module) {
  const [manifestPath, resultsPath, reportPath] = process.argv.slice(2);
  if (!manifestPath || !resultsPath) throw new Error("Usage: node scripts/video-benchmark-evaluator.cjs <manifest.json> <results.json> [report.json]");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const evaluated = evaluateBenchmark(manifest.fixtures, results.outputs ?? results);
  const report = { generatedAt: new Date().toISOString(), benchmark: manifest.benchmark, ...evaluated, thresholdEvaluation: evaluateThresholds(evaluated.metrics, manifest.benchmark?.thresholds) };
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.thresholdEvaluation.passed) process.exitCode = 1;
}
