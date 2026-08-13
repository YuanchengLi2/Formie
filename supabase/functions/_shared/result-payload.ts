import type { AnalysisCandidate } from "./analysis-contract.ts";
import { historicalResultPayload } from "../_historical/legacy-result-payload.ts";
import { parseSetDeclaration } from "./set-declaration.ts";

const WHOLE_VIDEO_PIPELINES = new Set([
  "gemini-whole-video-v46",
  "gemini-whole-video-v47",
  "gemini-whole-video-v48",
  "gemini-whole-video-v48-recheck1",
  "gemini-whole-video-v48-recheck2",
  "gemini-whole-video-v50",
  "gemini-whole-video-v51",
  "gemini-whole-video-v52",
  "gemini-whole-video-v53-readable-coaching",
  "gemini-whole-video-v54-required-four-coaching",
  "gemini-whole-video-v55-single-pass-coaching",
  "gemini-whole-video-v56-single-call-rep-audit",
  "gemini-whole-video-v72-leased-direct-ai-coaching",
  "gemini-whole-video-v73-focused-analyst-flash-lite-writer",
]);

function isWholeVideoPipeline(value: unknown): boolean {
  const version = String(value ?? "");
  if (WHOLE_VIDEO_PIPELINES.has(version)) return true;
  const match = version.match(/^gemini-whole-video-v(\d+)(?:-|$)/);
  return Boolean(match && Number(match[1]) >= 57 && Number(match[1]) <= 68);
}

function currentResultPayload(session: Record<string, unknown>, result: Record<string, unknown>): AnalysisCandidate {
  const declaration = session.set_declaration ? parseSetDeclaration(session.set_declaration) : null;
  return {
    status: result.status as AnalysisCandidate["status"],
    analysisBasis: result.analysis_basis === "declared_only" ? "declared_only" : "observed",
    viewNotes: Array.isArray(result.view_notes) ? result.view_notes as string[] : [],
    generalGuidance: Array.isArray(result.general_guidance) ? result.general_guidance as string[] : [],
    recognition: {
      label: declaration?.exercise.label ?? String(session.detected_label ?? "Exercise attempt"),
      variation: (session.detected_variation ?? null) as string | null,
      equipment: (session.detected_equipment ?? []) as string[],
      confidence: declaration ? 1 : Number(session.recognition_confidence ?? 0),
      alternatives: declaration ? [] : (session.recognition_alternatives ?? []) as string[],
      catalogExerciseId: declaration?.exercise.catalogExerciseId ?? (session.exercise_variant_v2_id ?? null) as number | null,
      exerciseFamily: (session.exercise_family ?? "other") as AnalysisCandidate["recognition"]["exerciseFamily"],
      ...(declaration ? { source: "user_declared" as const } : {}),
    },
    overallAssessment: (result.overall_assessment ?? null) as string | null,
    muscleFocus: result.muscle_focus as AnalysisCandidate["muscleFocus"],
    coachNote: (result.coach_note ?? null) as string | null,
    score: (result.score ?? null) as number | null,
    scoreRationale: (result.score_rationale ?? []) as AnalysisCandidate["scoreRationale"],
    movementScores: (result.movement_scores ?? []) as NonNullable<AnalysisCandidate["movementScores"]>,
    scorecard: null,
    equipmentObservations: (result.equipment_observations ?? []) as AnalysisCandidate["equipmentObservations"],
    exerciseGuide: (result.exercise_guide ?? null) as AnalysisCandidate["exerciseGuide"],
    didWell: (result.did_well ?? []) as AnalysisCandidate["didWell"],
    priorityCorrections: (result.priority_corrections ?? []) as AnalysisCandidate["priorityCorrections"],
    coachingCues: (result.coaching_cues ?? []) as AnalysisCandidate["coachingCues"],
    setContext: result.set_context as AnalysisCandidate["setContext"],
    setSummary: result.set_summary as AnalysisCandidate["setSummary"],
    nextSetPlan: (result.next_set_plan ?? []) as AnalysisCandidate["nextSetPlan"],
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    comparison: (result.comparison ?? null) as AnalysisCandidate["comparison"],
    setDeclaration: declaration,
  };
}

export function resultPayload(session: Record<string, unknown>, result: Record<string, unknown> | null, v49Result?: Record<string, unknown> | null): AnalysisCandidate | null {
  if (session.pipeline_version === "gemini-problem-finder-v49" || session.active_v49_run_id) {
    return (v49Result ?? null) as AnalysisCandidate | null;
  }
  if (!result) return null;
  return isWholeVideoPipeline(session.pipeline_version)
    ? currentResultPayload(session, result)
    : historicalResultPayload(session, result);
}
