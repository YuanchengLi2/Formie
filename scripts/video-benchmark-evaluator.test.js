const { evaluateBenchmark, evaluateThresholds } = require("./video-benchmark-evaluator.cjs");

describe("video benchmark evaluator", () => {
  const fixtures = [
    { id: "row-good", pairId: "row-1", expectedExercise: "bent-over dumbbell row", expectedQuality: "good", expectedView: "diagonal", expectedEquipment: ["dumbbell"], expectedLoad: "unreadable" },
    { id: "row-bad", pairId: "row-1", expectedExercise: "bent-over dumbbell row", expectedQuality: "bad", expectedView: "diagonal", expectedEquipment: ["dumbbell"], expectedLoad: "unreadable" },
  ];
  const output = (id, score, corrections = [], exactLoad = false) => ({
    id,
    status: "complete",
    score,
    recognition: { label: "Bent-over dumbbell row", equipment: ["dumbbells"], confidence: 0.9 },
    priorityCorrections: corrections,
    nextSetPlan: [{ id: `${id}-plan`, action: "Repeat the visible setup and path.", rationale: "Use the visible set as the reference.", successCheck: "The path remains repeatable.", relatedFindingId: corrections[0]?.id ?? null }],
    equipmentObservations: [{ id: `${id}-load`, category: "visible_load", load: exactLoad ? { value: 20, unit: "kg", certainty: "exact_visible", basis: "readable_label" } : { value: null, unit: null, certainty: "unknown", basis: "not_readable" }, evidence: [{ startMs: 100, peakMs: 200, endMs: 300, confidence: 0.9 }] }],
    evidenceTiming: corrections.flatMap((finding) => finding.evidence ?? []),
    boundaryEvidenceCount: 0,
    clientSchemaValid: true,
    cameraGeometry: { view: "front-45", height: "mid", tilt: "level", distance: "medium", framing: "full-body" },
    elapsedMs: id === "row-good" ? 1_000 : 3_000,
    setSummary: { totalReps: 8 },
    telemetry: [{ stage: "indexer", status: "complete" }],
  });

  it("measures matched-pair score ordering, detection, false positives, and load-claim safety", () => {
    const report = evaluateBenchmark(fixtures, [
      output("row-good", 88),
      output("row-bad", 62, [{ id: "swing", severity: "important", evidence: [{ startMs: 100, peakMs: 200, endMs: 300, confidence: 0.9 }] }]),
    ]);

    expect(report.metrics).toMatchObject({
      completionRate: 1,
      recognitionAccuracy: 1,
      goodFalsePositiveRate: 0,
      badSignalRecall: 1,
      badCorrectionRecall: 1,
      exerciseCorrectionCoverage: 1,
      actionableCoachingCoverage: 1,
      pairwiseRankingAccuracy: 1,
      unsafeExactLoadClaimRate: 0,
      evidenceBoundaryRate: 0,
      clientSchemaValidityRate: 1,
      cameraViewAccuracy: 1,
      evidenceIntervalValidityRate: 1,
      modelFailureRate: 0,
      averageLatencyMs: 2_000,
      p95LatencyMs: 3_000,
    });
    expect(report.pairs[0]).toMatchObject({ pairId: "row-1", scoreGap: 26, passed: true });
  });

  it("flags invented exact loads and bad sets that outrank their matched good set", () => {
    const report = evaluateBenchmark(fixtures, [output("row-good", 70), output("row-bad", 82, [], true)]);
    expect(report.metrics.pairwiseRankingAccuracy).toBe(0);
    expect(report.metrics.badSignalRecall).toBe(0);
    expect(report.metrics.badCorrectionRecall).toBe(0);
    expect(report.metrics.exerciseCorrectionCoverage).toBe(0);
    expect(report.metrics.actionableCoachingCoverage).toBe(1);
    expect(report.metrics.unsafeExactLoadClaimRate).toBe(0.5);
  });

  it("does not count a schema-invalid terminal payload as complete", () => {
    const invalid = { ...output("row-good", 88), clientSchemaValid: false };
    const report = evaluateBenchmark(fixtures, [invalid, output("row-bad", 62)]);

    expect(report.cases[0]).toMatchObject({ terminal: true, schemaValid: false, complete: false });
    expect(report.metrics.completionRate).toBe(0.5);
    expect(report.metrics.clientSchemaValidityRate).toBe(0.5);
  });

  it("measures invalid evidence, rep-count error, and model failures", () => {
    const repFixtures = fixtures.map((fixture) => ({ ...fixture, expectedRepCount: 10, repCountTolerance: 1 }));
    const first = {
      ...output("row-good", 88),
      setSummary: { totalReps: 9 },
      evidenceTiming: [{ startMs: 300, peakMs: 200, endMs: 400, confidence: 0.9 }],
      telemetry: [{ stage: "analyst", status: "failed", error_code: "MODEL_ERROR" }],
    };
    const second = { ...output("row-bad", 62), setSummary: { totalReps: 13 } };
    const report = evaluateBenchmark(repFixtures, [first, second]);

    expect(report.cases[0]).toMatchObject({ evidenceIntervalsValid: false, repCountError: 1, repCountPassed: true, modelFailed: true });
    expect(report.cases[1]).toMatchObject({ repCountError: 3, repCountPassed: false });
    expect(report.metrics).toMatchObject({
      evidenceIntervalValidityRate: 0.5,
      repCountWithinToleranceRate: 0.5,
      meanAbsoluteRepCountError: 2,
      modelFailureRate: 0.5,
    });
  });

  it("flags a wrong camera direction", () => {
    const first = { ...output("row-good", 88), cameraGeometry: { view: "rear", height: "mid", tilt: "level", distance: "medium", framing: "full-body" } };
    const report = evaluateBenchmark(fixtures, [first, output("row-bad", 62)]);

    expect(report.cases[0]).toMatchObject({ cameraViewPassed: false });
    expect(report.metrics.cameraViewAccuracy).toBe(0.5);
  });

  it("fails missing metrics and applies both minimum and maximum gates", () => {
    const gate = evaluateThresholds(
      { completionRate: 0.9, modelFailureRate: 0.1 },
      { completionRate: 0.95, modelFailureRateMax: 0.05, clientSchemaValidityRate: 1 },
    );
    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual(expect.arrayContaining([
      expect.stringContaining("completionRate"),
      expect.stringContaining("modelFailureRate"),
      expect.stringContaining("clientSchemaValidityRate"),
    ]));
  });
});
