import type { AnalysisCandidate } from "./analysis-contract.ts";

function normalizeFindings(findings: AnalysisCandidate["priorityCorrections"]): AnalysisCandidate["priorityCorrections"] {
  return findings.map((finding) => ({
    ...finding,
    evidence: finding.evidence.map((moment) => ({ ...moment, coachingNote: moment.coachingNote ?? moment.visualEvidence, focusRegion: moment.focusRegion ?? null })),
  }));
}

export function resultPayload(session: Record<string, unknown>, result: Record<string, unknown> | null): AnalysisCandidate | null {
  if (!result) return null;
  const status = result.status as AnalysisCandidate["status"];
  const didWell = normalizeFindings((result.did_well ?? []) as AnalysisCandidate["didWell"]);
  const priorityCorrections = normalizeFindings((result.priority_corrections ?? []) as AnalysisCandidate["priorityCorrections"]);
  const coachingCues = normalizeFindings((result.coaching_cues ?? []) as AnalysisCandidate["coachingCues"]);
  const persistedPlan = (result.next_set_plan ?? []) as AnalysisCandidate["nextSetPlan"];
  const source = priorityCorrections[0] ?? coachingCues[0] ?? didWell[0] ?? null;
  const nextSetPlan = status === "unable" || persistedPlan.length > 0
    ? persistedPlan
    : [{
      id: "legacy-next-set",
      action: source?.correction ?? source?.cue ?? "Repeat the set with the same controlled rep path",
      rationale: source?.whyItMatters ?? "A repeatable set gives you a clear baseline for the next review.",
      relatedFindingId: source?.id ?? null,
    }];
  return {
    status,
    recognition: {
      label: (session.corrected_label ?? session.detected_label ?? null) as string | null,
      variation: (session.detected_variation ?? null) as string | null,
      equipment: (session.detected_equipment ?? []) as string[],
      confidence: Number(session.recognition_confidence ?? 0),
      alternatives: (session.recognition_alternatives ?? []) as string[],
      catalogExerciseId: (session.corrected_exercise_id ?? session.exercise_id ?? null) as number | null,
      exerciseFamily: (session.exercise_family ?? "other") as AnalysisCandidate["recognition"]["exerciseFamily"],
    },
    videoCheck: result.video_check as AnalysisCandidate["videoCheck"],
    overallAssessment: (result.overall_assessment ?? null) as string | null,
    score: result.score === null || result.score === undefined ? null : Number(result.score),
    scoreRationale: (result.score_rationale ?? []) as AnalysisCandidate["scoreRationale"],
    didWell,
    priorityCorrections,
    coachingCues,
    setContext: (result.set_context ?? { cameraView: null, visibleReferences: [], sequenceSummary: null, changeAcrossSet: null, coachingBasis: null }) as AnalysisCandidate["setContext"],
    setSummary: (result.set_summary ?? { totalReps: null, consistentReps: null, verdict: null }) as AnalysisCandidate["setSummary"],
    repTimeline: (result.rep_timeline ?? []) as AnalysisCandidate["repTimeline"],
    nextSetPlan,
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    precisionReview: (result.precision_review ?? { runsRequested: 0, runsUsed: Number(result.premium_runs_used ?? 0), status: "not-needed", summary: null, passes: [] }) as AnalysisCandidate["precisionReview"],
    verification: (result.verification ?? undefined) as AnalysisCandidate["verification"],
    comparison: (result.comparison ?? null) as AnalysisCandidate["comparison"],
  };
}
