const fs = require("node:fs");

const CAMERA_LANGUAGE = /\b(camera|phone|angle|framing|frame the|orientation|viewpoint|recording direction|move farther|move closer)\b/i;
const HIDDEN_INTERNAL_LANGUAGE = /\b(glutes?|quads?|hamstrings?|biceps?|triceps?|pecs?|lats?|muscles?|core)\b.{0,50}\b(stop(?:ped|s)?\s+(?:contribut|activat)|not\s+(?:contribut|activat)|deactivat|disengag)/i;
const FATIGUE_OR_LOAD_LANGUAGE = /\b(fatigue|fatigued|tired|reduce\s+(?:the\s+)?(?:load|weight)|lower\s+(?:the\s+)?(?:load|weight))\b/i;

function normalize(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function ratio(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : null;
}

function evaluateRows(rows, toleranceMs = 750) {
  let exerciseMatches = 0;
  let correctionMatches = 0;
  let timedExamples = 0;
  let evidenceMatches = 0;
  let cameraComments = 0;
  let verifierInvocations = 0;
  let premiumRuns = 0;
  let evidenceMoments = 0;
  let pointAdviceMoments = 0;
  let unsupportedInternalClaims = 0;
  let unsupportedFatigueClaims = 0;
  const verifierUsage = { promptTokens: 0, outputTokens: 0, thinkingTokens: 0 };
  const failures = [];

  for (const [index, row] of rows.entries()) {
    const result = row.result ?? {};
    const expectedExercises = (Array.isArray(row.expectedExercise) ? row.expectedExercise : [row.expectedExercise]).filter(Boolean).map(normalize);
    const detected = normalize(result.recognition?.label);
    const exerciseOk = expectedExercises.some((expected) => detected.includes(expected) || expected.includes(detected));
    if (exerciseOk) exerciseMatches += 1;

    const topFinding = result.priorityCorrections?.[0] ?? null;
    const findingText = normalize([topFinding?.title, topFinding?.detail, topFinding?.correction, topFinding?.cue].filter(Boolean).join(" "));
    const keywords = (row.expectedPriorityKeywords ?? []).map(normalize).filter(Boolean);
    const correctionOk = keywords.length === 0 || keywords.every((keyword) => findingText.includes(keyword));
    if (correctionOk) correctionMatches += 1;

    let evidenceOk = true;
    if (Number.isFinite(row.expectedEvidenceMs)) {
      timedExamples += 1;
      const observedPeak = topFinding?.evidence?.[0]?.peakMs;
      evidenceOk = Number.isFinite(observedPeak) && Math.abs(observedPeak - row.expectedEvidenceMs) <= toleranceMs;
      if (evidenceOk) evidenceMatches += 1;
    }

    const coachingText = JSON.stringify({
      overallAssessment: result.overallAssessment,
      didWell: result.didWell,
      priorityCorrections: result.priorityCorrections,
      coachingCues: result.coachingCues,
      nextSetPlan: result.nextSetPlan,
    });
    const cameraCommentary = CAMERA_LANGUAGE.test(coachingText);
    if (cameraCommentary) cameraComments += 1;

    const findings = [result.didWell, result.priorityCorrections, result.coachingCues].flatMap((items) => Array.isArray(items) ? items : []);
    const moments = findings.flatMap((finding) => Array.isArray(finding?.evidence) ? finding.evidence : []);
    evidenceMoments += moments.length;
    pointAdviceMoments += moments.filter((moment) => typeof moment?.coachingNote === "string" && moment.coachingNote.trim()).length;
    const hiddenInternalClaim = moments.some((moment) => HIDDEN_INTERNAL_LANGUAGE.test(String(moment?.coachingNote ?? "")));
    if (hiddenInternalClaim) unsupportedInternalClaims += 1;
    const unsupportedFatigue = findings.some((finding) => {
      const evidence = Array.isArray(finding?.evidence) ? finding.evidence : [];
      if (!evidence.some((moment) => FATIGUE_OR_LOAD_LANGUAGE.test(String(moment?.coachingNote ?? "")))) return false;
      const reps = new Set(evidence.map((moment) => moment?.repNumber).filter((value) => Number.isInteger(value)));
      const peaks = evidence.map((moment) => Number(moment?.peakMs)).filter(Number.isFinite);
      const span = peaks.length > 1 ? Math.max(...peaks) - Math.min(...peaks) : 0;
      return !(evidence.length >= 2 && (reps.size >= 2 || span >= 1_500));
    });
    if (unsupportedFatigue) unsupportedFatigueClaims += 1;

    const runsUsed = 0;
    premiumRuns += runsUsed;
    if (runsUsed > 0) verifierInvocations += 1;
    const passUsage = [];
    for (const usage of passUsage) {
      for (const key of Object.keys(verifierUsage)) verifierUsage[key] += Number(usage[key] ?? 0);
    }

    const checks = [];
    if (!exerciseOk) checks.push("exercise");
    if (!correctionOk) checks.push("priority-correction");
    if (!evidenceOk) checks.push("evidence-time");
    if (cameraCommentary) checks.push("camera-commentary");
    if (moments.some((moment) => typeof moment?.coachingNote !== "string" || !moment.coachingNote.trim())) checks.push("point-advice");
    if (hiddenInternalClaim) checks.push("hidden-inference");
    if (unsupportedFatigue) checks.push("unsupported-fatigue");
    if (checks.length) failures.push({ id: row.id ?? `row-${index + 1}`, checks });
  }

  return {
    total: rows.length,
    toleranceMs,
    exerciseRecognitionRate: ratio(exerciseMatches, rows.length),
    priorityCorrectionAgreementRate: ratio(correctionMatches, rows.length),
    evidenceWithinToleranceRate: ratio(evidenceMatches, timedExamples),
    cameraCommentaryRate: ratio(cameraComments, rows.length),
    verifierInvocationRate: ratio(verifierInvocations, rows.length),
    premiumRunsAverage: ratio(premiumRuns, rows.length),
    pointAdviceCoverageRate: ratio(pointAdviceMoments, evidenceMoments),
    unsupportedInternalClaimRate: ratio(unsupportedInternalClaims, rows.length),
    fatigueWithoutRepeatedEvidenceRate: ratio(unsupportedFatigueClaims, rows.length),
    verifierUsage,
    failures,
  };
}

if (require.main === module) {
  const file = process.argv[2];
  const toleranceMs = Number(process.argv[3] ?? 750);
  if (!file) {
    console.error("Usage: npm run evaluate:coaching -- <labeled-results.jsonl> [tolerance-ms]");
    process.exit(1);
  }
  const rows = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
  console.log(JSON.stringify(evaluateRows(rows, toleranceMs), null, 2));
}

module.exports = { evaluateRows };
