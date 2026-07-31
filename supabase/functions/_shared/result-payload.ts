import type { AnalysisCandidate } from "./analysis-contract.ts";
import { enforceCorrectionCoaching } from "./coaching-contract.ts";
import { calibratedTechniqueScore } from "./score-calibration.ts";
import { parseSetDeclaration } from "./set-declaration.ts";
import { normalizeEquipmentLoad } from "./equipment-load.ts";

const MUSCLE_REGIONS = new Set([
  "chest", "front_shoulders", "rear_shoulders", "upper_back", "lats", "biceps", "triceps", "forearms",
  "abs", "obliques", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves",
]);
const ANATOMY_REGIONS = new Set([
  "chest", "shoulders", "upper_back", "lats", "upper_arms", "elbows", "forearms", "wrists", "torso",
  "lower_back", "hips", "glutes", "quads", "hamstrings", "adductors", "knees", "calves", "ankles",
]);

function normalizeMuscleFocus(value: unknown): AnalysisCandidate["muscleFocus"] {
  if (Array.isArray(value)) {
    return {
      primary: [],
      secondary: [],
      unclassified: value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()),
    };
  }
  if (!value || typeof value !== "object") return { primary: [], secondary: [], unclassified: [] };
  const source = value as Record<string, unknown>;
  const targets = (input: unknown): AnalysisCandidate["muscleFocus"]["primary"] =>
    Array.isArray(input)
      ? input.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const target = item as Record<string, unknown>;
        return typeof target.name === "string"
          && target.name.trim()
          && typeof target.region === "string"
          && MUSCLE_REGIONS.has(target.region)
          ? [{ name: target.name.trim(), region: target.region as AnalysisCandidate["muscleFocus"]["primary"][number]["region"] }]
          : [];
      })
      : [];
  const uniqueTargets = (items: AnalysisCandidate["muscleFocus"]["primary"]) => items.filter(
    (target, index) => items.findIndex((candidate) => candidate.region === target.region) === index,
  );
  const primary = uniqueTargets(targets(source.primary));
  const primaryRegions = new Set(primary.map((target) => target.region));
  const secondary = uniqueTargets(targets(source.secondary)).filter((target) => !primaryRegions.has(target.region));
  const unclassified = Array.isArray(source.unclassified)
    ? source.unclassified.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
  return { primary, secondary, unclassified };
}

function normalizeFindings(
  findings: AnalysisCandidate["priorityCorrections"],
  requireActionable = false,
): AnalysisCandidate["priorityCorrections"] {
  return findings.map((finding) => ({
    ...finding,
    observedIssueRegions: (Array.isArray(finding.observedIssueRegions) ? finding.observedIssueRegions : [])
      .filter((region): region is NonNullable<typeof finding.observedIssueRegions>[number] =>
        typeof region === "string" && ANATOMY_REGIONS.has(region)
      ),
    actionableCorrection: finding.actionableCorrection ?? (finding.correction || finding.cue || requireActionable ? {
      instruction: finding.correction ?? finding.cue ?? `Repeat the visible improvement described in “${finding.title}”.`,
      cue: finding.cue ?? finding.correction ?? finding.title,
      successCheck: `Repeat the visible relationship described in “${finding.title}” without the cited deviation.`,
      applyWhen: "On the next repetition at the cited phase.",
    } : null),
    evidence: finding.evidence.map((moment) => ({ ...moment, coachingNote: moment.coachingNote ?? moment.visualEvidence, focusRegion: moment.focusRegion ?? null })),
    primaryEvidenceIndex: Number.isInteger(finding.primaryEvidenceIndex)
      && Number(finding.primaryEvidenceIndex) >= 0
      && Number(finding.primaryEvidenceIndex) < finding.evidence.length
      ? Number(finding.primaryEvidenceIndex)
      : 0,
  }));
}

function normalizeEquipmentObservations(value: unknown): AnalysisCandidate["equipmentObservations"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const observation = item as Record<string, unknown>;
    return [{
      ...observation,
      load: normalizeEquipmentLoad(observation.load, observation),
    } as AnalysisCandidate["equipmentObservations"][number]];
  });
}

export function resultPayload(session: Record<string, unknown>, result: Record<string, unknown> | null): AnalysisCandidate | null {
  if (!result) return null;
  const status = result.status as AnalysisCandidate["status"];
  const didWell = normalizeFindings((result.did_well ?? []) as AnalysisCandidate["didWell"]);
  const normalizedCorrections = normalizeFindings(
    (result.priority_corrections ?? []) as AnalysisCandidate["priorityCorrections"],
    true,
  );
  const priorityCorrections = ["gemini-analyst-coach-v18", "gemini-analyst-coach-v19", "gemini-analyst-coach-v20", "gemini-analyst-coach-v21", "gemini-analyst-coach-v22", "gemini-analyst-coach-v23", "gemini-analyst-coach-v24", "gemini-analyst-coach-v25", "gemini-analyst-coach-v26", "gemini-analyst-coach-v27", "gemini-analyst-coach-v28", "gemini-analyst-coach-v29", "gemini-analyst-coach-v30", "gemini-analyst-coach-v31", "gemini-analyst-coach-v32", "gemini-analyst-coach-v33"].includes(String(result.pipeline_version))
    ? normalizedCorrections
    : normalizedCorrections.map(enforceCorrectionCoaching);
  const coachingCues = normalizeFindings((result.coaching_cues ?? []) as AnalysisCandidate["coachingCues"]);
  let declaration: ReturnType<typeof parseSetDeclaration> | null = null;
  try {
    declaration = session.set_declaration ? parseSetDeclaration(session.set_declaration) : null;
  } catch {
    declaration = null;
  }
  const correctionIds = new Set(priorityCorrections.map((finding) => finding.id));
  const persistedPlan = (result.next_set_plan ?? []) as AnalysisCandidate["nextSetPlan"];
  const validPersistedPlan = persistedPlan.filter((plan) =>
    plan.relatedFindingId !== null && correctionIds.has(plan.relatedFindingId)
  );
  const firstCorrection = priorityCorrections[0] ?? null;
  const nextSetPlan = validPersistedPlan.length > 0
    ? validPersistedPlan
    : firstCorrection
      ? [{
        id: "legacy-next-set",
        action: firstCorrection.correction ?? firstCorrection.cue ?? firstCorrection.title,
        rationale: firstCorrection.whyItMatters,
        successCheck: firstCorrection.actionableCorrection?.successCheck ?? "The cited deviation is no longer visible.",
        relatedFindingId: firstCorrection.id,
      }]
      : [];
  const hasPersistedScore = result.score !== null
    && result.score !== undefined
    && Number.isFinite(Number(result.score));
  const rawScore = status === "unable"
    ? null
    : hasPersistedScore
      ? Math.max(0, Math.min(100, Number(result.score)))
      : 75;
  const score = rawScore === null
    ? null
    : hasPersistedScore
      ? calibratedTechniqueScore(rawScore, priorityCorrections)
      : rawScore;
  return {
    status,
    recognition: {
      label: declaration?.exercise.label ?? (session.corrected_label ?? session.detected_label ?? null) as string | null,
      variation: (session.detected_variation ?? null) as string | null,
      equipment: (session.detected_equipment ?? []) as string[],
      confidence: declaration ? 1 : Number(session.recognition_confidence ?? 0),
      alternatives: declaration ? [] : (session.recognition_alternatives ?? []) as string[],
      catalogExerciseId: declaration?.exercise.catalogExerciseId ?? (session.corrected_exercise_id ?? session.exercise_variant_v2_id ?? session.exercise_id ?? null) as number | null,
      exerciseFamily: (session.exercise_family ?? "other") as AnalysisCandidate["recognition"]["exerciseFamily"],
      source: declaration ? "user_declared" : "legacy_model",
    },
    videoCheck: result.video_check as AnalysisCandidate["videoCheck"],
    overallAssessment: (result.overall_assessment ?? null) as string | null,
    muscleFocus: normalizeMuscleFocus(result.muscle_focus),
    coachNote: typeof result.coach_note === "string" && result.coach_note.trim()
      ? result.coach_note.trim()
      : null,
    score,
    scoreRationale: (result.score_rationale ?? []) as AnalysisCandidate["scoreRationale"],
    movementScores: (result.movement_scores ?? []) as NonNullable<AnalysisCandidate["movementScores"]>,
    scorecard: (result.scorecard ?? null) as AnalysisCandidate["scorecard"],
    equipmentObservations: normalizeEquipmentObservations(result.equipment_observations),
    ...(result.exercise_guide && typeof result.exercise_guide === "object"
      ? { exerciseGuide: result.exercise_guide as AnalysisCandidate["exerciseGuide"] }
      : {}),
    ...(Array.isArray(result.coaching_coverage) && result.coaching_coverage.length > 0
      ? { coachingCoverage: result.coaching_coverage as NonNullable<AnalysisCandidate["coachingCoverage"]> }
      : {}),
    didWell,
    priorityCorrections,
    coachingCues,
    setContext: (result.set_context ?? { cameraView: null, visibleReferences: [], sequenceSummary: null, changeAcrossSet: null, coachingBasis: null }) as AnalysisCandidate["setContext"],
    setSummary: {
      ...((result.set_summary ?? { totalReps: null, consistentReps: null, verdict: null }) as AnalysisCandidate["setSummary"]),
      ...(declaration?.amount.kind === "reps" ? { totalReps: declaration.amount.value } : {}),
    },
    repTimeline: (result.rep_timeline ?? []) as AnalysisCandidate["repTimeline"],
    nextSetPlan,
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    comparison: (result.comparison ?? null) as AnalysisCandidate["comparison"],
    setDeclaration: declaration,
  };
}
