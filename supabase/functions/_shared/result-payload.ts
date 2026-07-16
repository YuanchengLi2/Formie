import type { AnalysisCandidate } from "./analysis-contract.ts";

export function resultPayload(session: Record<string, unknown>, result: Record<string, unknown> | null): AnalysisCandidate | null {
  if (!result) return null;
  return {
    status: result.status as AnalysisCandidate["status"],
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
    didWell: (result.did_well ?? []) as AnalysisCandidate["didWell"],
    priorityCorrections: (result.priority_corrections ?? []) as AnalysisCandidate["priorityCorrections"],
    coachingCues: (result.coaching_cues ?? []) as AnalysisCandidate["coachingCues"],
    setSummary: (result.set_summary ?? { totalReps: null, consistentReps: null, verdict: null }) as AnalysisCandidate["setSummary"],
    repTimeline: (result.rep_timeline ?? []) as AnalysisCandidate["repTimeline"],
    nextSetPlan: (result.next_set_plan ?? []) as AnalysisCandidate["nextSetPlan"],
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    precisionReview: (result.precision_review ?? { runsRequested: 0, runsUsed: Number(result.premium_runs_used ?? 0), status: "not-needed", summary: null, passes: [] }) as AnalysisCandidate["precisionReview"],
    verification: (result.verification ?? undefined) as AnalysisCandidate["verification"],
    comparison: (result.comparison ?? null) as AnalysisCandidate["comparison"],
  };
}
