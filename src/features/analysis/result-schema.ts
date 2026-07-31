import { z } from "zod";
import { exerciseFamilies } from "@/features/exercises/exercise-family";
import { setDeclarationSchema } from "./set-declaration";

const EVIDENCE_REP_TOLERANCE_MS = 1_000;
export const muscleRegions = ["chest", "front_shoulders", "rear_shoulders", "upper_back", "lats", "biceps", "triceps", "forearms", "abs", "obliques", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves"] as const;
export const anatomyRegions = ["chest", "shoulders", "upper_back", "lats", "upper_arms", "elbows", "forearms", "wrists", "torso", "lower_back", "hips", "glutes", "quads", "hamstrings", "adductors", "knees", "calves", "ankles"] as const;
type MuscleRegionName = (typeof muscleRegions)[number];

const MUSCLE_NAME_REGIONS: readonly [MuscleRegionName, RegExp][] = [
  ["chest", /\b(?:chest|pecs?|pectoralis|pectorals?)\b/i],
  ["rear_shoulders", /\b(?:rear|posterior)\s+(?:delts?|deltoids?|shoulders?)\b/i],
  ["front_shoulders", /\b(?:(?:front|anterior)\s+(?:delts?|deltoids?|shoulders?)|delts?|deltoids?|shoulders?)\b/i],
  ["upper_back", /\b(?:upper back|traps?|trapezius|rhomboids?)\b/i],
  ["lats", /\b(?:lats?|latissimus(?: dorsi)?)\b/i],
  ["biceps", /\b(?:biceps?|brachialis|coracobrachialis)\b/i],
  ["triceps", /\b(?:triceps?|anconeus)\b/i],
  ["forearms", /\b(?:forearms?|brachioradialis|wrist flexors?|wrist extensors?|pronators?|supinators?)\b/i],
  ["obliques", /\b(?:obliques?)\b/i],
  ["abs", /\b(?:abs|abdominals?|rectus abdominis|transversus abdominis)\b/i],
  ["lower_back", /\b(?:lower back|erector spinae|multifidus|quadratus lumborum)\b/i],
  ["glutes", /\b(?:glutes?|gluteus)\b/i],
  ["quads", /\b(?:quads?|quadriceps|rectus femoris|vastus)\b/i],
  ["hamstrings", /\b(?:hamstrings?|biceps femoris|semimembranosus|semitendinosus)\b/i],
  ["adductors", /\b(?:adductors?|inner thighs?|gracilis)\b/i],
  ["calves", /\b(?:calves?|gastrocnemius|soleus)\b/i],
];

const muscleTargetSchema = z.object({
  name: z.string().min(1),
  region: z.enum(muscleRegions),
});

const rawStructuredMuscleFocusSchema = z.object({
  primary: z.array(muscleTargetSchema).max(8),
  secondary: z.array(muscleTargetSchema).max(8),
  unclassified: z.array(z.string().min(1)).max(8).optional().default([]),
});

function canonicalMuscleFocus(focus: z.infer<typeof rawStructuredMuscleFocusSchema>) {
  const unclassified = [...focus.unclassified];
  const canonicalize = (targets: typeof focus.primary) => targets.flatMap((target) => {
    const region = MUSCLE_NAME_REGIONS.find(([, pattern]) => pattern.test(target.name))?.[0] ?? null;
    if (region === null) {
      unclassified.push(target.name);
      return [];
    }
    return [{ ...target, region }];
  });
  return {
    primary: canonicalize(focus.primary),
    secondary: canonicalize(focus.secondary),
    unclassified: [...new Set(unclassified)].slice(0, 8),
  };
}

const structuredMuscleFocusSchema = rawStructuredMuscleFocusSchema.transform(canonicalMuscleFocus).superRefine((focus, context) => {
  const primaryRegions = new Set(focus.primary.map((target) => target.region));
  const secondaryRegions = new Set(focus.secondary.map((target) => target.region));
  if (primaryRegions.size !== focus.primary.length) {
    context.addIssue({ code: "custom", path: ["primary"], message: "Primary muscle regions must be unique" });
  }
  if (secondaryRegions.size !== focus.secondary.length) {
    context.addIssue({ code: "custom", path: ["secondary"], message: "Supporting muscle regions must be unique" });
  }
  focus.secondary.forEach((target, index) => {
    if (primaryRegions.has(target.region)) {
      context.addIssue({
        code: "custom",
        path: ["secondary", index, "region"],
        message: "A muscle region cannot be both primary and supporting",
      });
    }
  });
});

const muscleFocusSchema = z.union([
  structuredMuscleFocusSchema,
  z.array(z.string().min(1)).max(8).transform((unclassified) => ({
    primary: [],
    secondary: [],
    unclassified,
  })),
]).optional().default({ primary: [], secondary: [], unclassified: [] });

const scoreRationaleSchema = z.object({
  criterion: z.string().min(1),
  observed: z.string().min(1),
  impact: z.number().min(0).max(100).nullable(),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string().min(1)).optional(),
});

const movementScoreSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(40),
  score: z.number().min(0).max(100),
  observed: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).default([]),
});

const movementScoresSchema = z.union([
  z.array(movementScoreSchema).length(0),
  z.array(movementScoreSchema).min(3).max(5),
]).optional();

const scoreCriterionSchema = z.object({
  key: z.enum(["setup_stability", "path_alignment", "range_positions", "control_tempo", "rep_consistency"]),
  weight: z.union([z.literal(15), z.literal(20), z.literal(25)]),
  rating: z.number().min(0).max(100).nullable(),
  confidence: z.number().min(0).max(1),
  observed: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
});

export const techniqueScorecardSchema = z.object({
  rubricVersion: z.literal("strict-technique-v1"),
  coverage: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  criteria: z.array(scoreCriterionSchema).length(5),
  uncappedScore: z.number().int().min(0).max(100).nullable(),
  appliedCap: z.union([z.literal(39), z.literal(59), z.literal(69)]).nullable(),
  finalScore: z.number().int().min(0).max(100).nullable(),
  auditStatus: z.enum(["single-pass", "confirmed", "adjudicated", "unavailable"]),
});

export const visualFocusRegionSchema = z.object({
  centerX: z.number().min(0).max(1),
  centerY: z.number().min(0).max(1),
  radius: z.number().min(0.06).max(0.3),
  arrowFromX: z.number().min(0).max(1),
  arrowFromY: z.number().min(0).max(1),
  label: z.string().min(1),
  confidence: z.number().min(0.4).max(1),
});

const equipmentLoadSchema = z.object({
  value: z.number().nonnegative().nullable(),
  unit: z.enum(["kg", "lb"]).nullable(),
  scope: z.string().min(1).nullable(),
  certainty: z.enum(["exact_visible", "partial_visible", "unknown"]),
  basis: z.enum(["readable_label", "readable_selector", "counted_visible_plates", "not_readable"]),
}).superRefine((load, context) => {
  if (load.certainty === "exact_visible" && (load.value === null || load.unit === null || load.scope === null || !["readable_label", "readable_selector"].includes(load.basis))) {
    context.addIssue({ code: "custom", message: "An exact load requires a readable label or selector, value, unit, and scope" });
  }
  if (load.certainty === "unknown" && (load.value !== null || load.unit !== null || load.basis !== "not_readable")) {
    context.addIssue({ code: "custom", message: "An unknown load cannot include a numeric claim" });
  }
  if (
    load.certainty === "partial_visible"
    && (
      load.basis !== "counted_visible_plates"
      || (load.value === null) !== (load.unit === null)
    )
  ) {
    context.addIssue({ code: "custom", message: "A partial load requires counted visible plates and matching value and unit visibility" });
  }
});

const equipmentEvidenceSchema = z.object({
  startMs: z.number().int().nonnegative(),
  peakMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  visualEvidence: z.string().min(1),
  visibleReferences: z.array(z.string().min(1)).min(1),
  confidence: z.number().min(0.75).max(1),
  focusRegion: visualFocusRegionSchema.nullable(),
}).refine((moment) => moment.startMs < moment.peakMs && moment.peakMs < moment.endMs, { message: "Equipment evidence peak must be inside its interval", path: ["peakMs"] });

export const equipmentObservationSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["visible_load", "setup", "balance", "equipment_motion", "limitation"]),
  title: z.string().min(1),
  observation: z.string().min(1),
  coachingRelevance: z.string().min(1).nullable(),
  load: equipmentLoadSchema.nullable(),
  evidence: z.array(equipmentEvidenceSchema).min(1),
});

export const evidenceMomentSchema = z
  .object({
    startMs: z.number().int().min(0),
    peakMs: z.number().int().min(0).optional(),
    endMs: z.number().int().positive(),
    repNumber: z.number().int().positive().nullable(),
    phase: z.string().min(1).nullable(),
    visualEvidence: z.string().min(1),
    coachingNote: z.string().min(1).max(360).optional(),
    visibleBodyAreas: z.array(z.string().min(1)).min(1),
    confidence: z.number().min(0.4).max(1),
    measurementIds: z.array(z.string().min(1)).optional(),
    focusRegion: visualFocusRegionSchema.nullable().optional(),
  })
  .refine((moment) => moment.endMs > moment.startMs, {
    message: "Evidence end time must follow its start time",
    path: ["endMs"],
  })
  .refine((moment) => moment.peakMs === undefined || (moment.startMs < moment.peakMs && moment.peakMs < moment.endMs), { message: "Evidence peak must fall strictly inside its interval", path: ["peakMs"] });

export const coachingFindingSchema = z.object({
  id: z.string().min(1),
  coachingArea: z.enum([
    "form",
    "load",
    "posture_setup",
    "equipment",
    "safety_surroundings",
    "grip_contact",
    "support_balance",
  ]).optional().default("form"),
  title: z.string().min(1),
  detail: z.string().min(1),
  whyItMatters: z.string().min(1),
  correction: z.string().min(1).nullable(),
  cue: z.string().min(1).nullable(),
  actionableCorrection: z.object({
    instruction: z.string().min(1),
    cue: z.string().min(1),
    successCheck: z.string().min(1).nullable(),
    applyWhen: z.string().min(1),
  }).nullable().optional(),
  expandedCoaching: z.object({
    summary: z.string().min(1),
    whatHappened: z.string().min(1),
    whyItMatters: z.string().min(1),
    whatToDo: z.string().min(1),
    successCheck: z.string().min(1).nullable(),
  }).optional(),
  severity: z.enum(["note", "important", "high"]),
  evidence: z.array(evidenceMomentSchema).min(1),
  primaryEvidenceIndex: z.number().int().nonnegative().optional(),
  observedIssueRegions: z.array(z.enum(anatomyRegions)).max(8).optional(),
}).refine((finding) => finding.primaryEvidenceIndex === undefined || finding.primaryEvidenceIndex < finding.evidence.length, {
  message: "Primary evidence index must select one of the finding's evidence moments",
  path: ["primaryEvidenceIndex"],
});

const recognitionSchema = z.object({
  label: z.string().min(1).nullable(),
  variation: z.string().min(1).nullable(),
  equipment: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.string().min(1)),
  catalogExerciseId: z.number().int().positive().nullable(),
  exerciseFamily: z.enum(exerciseFamilies),
  source: z.enum(["user_declared", "legacy_model"]).optional(),
});

const videoCheckSchema = z.object({
  outcome: z.enum(["usable", "partial", "unable"]),
  usableObservations: z.array(z.string().min(1)),
  limitations: z.array(z.string().min(1)),
  retryReason: z.string().min(1).nullable(),
  retryInstruction: z.string().min(1).nullable(),
});

const comparisonSchema = z.object({
  previousSessionId: z.string().min(1),
  summary: z.string().min(1),
  priorityIssueImproved: z.boolean().nullable(),
});

const setSummarySchema = z.object({
  totalReps: z.number().int().positive().nullable(),
  consistentReps: z.number().int().nonnegative().nullable(),
  verdict: z.string().min(1).nullable(),
}).refine((summary) => summary.totalReps === null || summary.consistentReps === null || summary.consistentReps <= summary.totalReps, {
  message: "Consistent repetitions cannot exceed total repetitions",
  path: ["consistentReps"],
});

const legacySetContext = {
  cameraView: null,
  visibleReferences: [] as string[],
  sequenceSummary: null,
  changeAcrossSet: null,
  coachingBasis: null,
};

const setContextSchema = z.object({
  cameraView: z.string().min(1).nullable(),
  visibleReferences: z.array(z.string().min(1)),
  sequenceSummary: z.string().min(1).nullable(),
  changeAcrossSet: z.string().min(1).nullable(),
  coachingBasis: z.string().min(1).nullable(),
});

const repTimelineItemSchema = z.object({
  repNumber: z.number().int().positive(),
  startMs: z.number().int().min(0),
  peakMs: z.number().int().min(0),
  endMs: z.number().int().positive(),
  assessment: z.enum(["strong", "consistent", "breakdown", "uncertain"]),
  note: z.string().min(1),
}).refine((rep) => rep.startMs <= rep.peakMs && rep.peakMs <= rep.endMs, { message: "Rep peak must fall inside its interval", path: ["peakMs"] });

const nextSetPlanItemSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  rationale: z.string().min(1),
  successCheck: z.string().min(1).optional(),
  relatedFindingId: z.string().min(1).nullable(),
});

type CoachingCoverageDomain =
  | "surroundings"
  | "equipment_setup"
  | "grip_contact"
  | "starting_position"
  | "movement_execution"
  | "support_balance";

const coachingCoverageItem = <T extends CoachingCoverageDomain>(domain: T) => z.object({
  domain: z.literal(domain),
  status: z.enum(["issue", "clear", "not_visible"]),
  observation: z.string().min(1),
  findingIds: z.array(z.string().min(1)).max(20),
});

const coachingCoverageSchema = z.tuple([
  coachingCoverageItem("surroundings"),
  coachingCoverageItem("equipment_setup"),
  coachingCoverageItem("grip_contact"),
  coachingCoverageItem("starting_position"),
  coachingCoverageItem("movement_execution"),
  coachingCoverageItem("support_balance"),
]);

const exerciseGuideSchema = z.object({
  setupSteps: z.array(z.string().min(1)).min(1).max(5),
  executionSteps: z.array(z.string().min(1)).min(1).max(5),
  relatedFindingIds: z.array(z.string().min(1)).max(20),
});

const precisionRequestSchema = z.object({
  requestedRuns: z.number().int().min(0).max(3),
  reason: z.string().min(1).nullable(),
  targets: z.array(z.object({
    kind: z.enum(["recognition", "timestamp", "technique"]),
    findingId: z.string().min(1).nullable(),
    startMs: z.number().int().nonnegative().nullable(),
    endMs: z.number().int().positive().nullable(),
    question: z.string().min(1),
  })).max(3),
});

export const analysisResultSchema = z
  .object({
    status: z.enum(["complete", "partial", "unable"]),
    recognition: recognitionSchema,
    videoCheck: videoCheckSchema,
    overallAssessment: z.string().min(1).nullable(),
    muscleFocus: muscleFocusSchema,
    coachNote: z.string().min(1).nullable().optional().default(null),
    score: z.number().min(0).max(100).nullable(),
    scoreRationale: z.array(scoreRationaleSchema),
    movementScores: movementScoresSchema,
    scorecard: techniqueScorecardSchema.nullable().optional(),
    equipmentObservations: z.array(equipmentObservationSchema).max(4).optional(),
    exerciseGuide: exerciseGuideSchema.nullable().optional(),
    coachingCoverage: coachingCoverageSchema.optional(),
    didWell: z.array(coachingFindingSchema),
    priorityCorrections: z.array(coachingFindingSchema),
    coachingCues: z.array(coachingFindingSchema),
    setContext: setContextSchema.optional().default(legacySetContext),
    setSummary: setSummarySchema.optional(),
    repTimeline: z.array(repTimelineItemSchema).optional(),
    nextSetPlan: z.array(nextSetPlanItemSchema).max(20).optional(),
    precisionRequest: precisionRequestSchema.optional(),
    comparison: comparisonSchema.nullable(),
    setDeclaration: setDeclarationSchema.nullable().optional(),
  })
  .superRefine((result, context) => {
    const findings = [...result.didWell, ...result.priorityCorrections, ...result.coachingCues];
    if ((result.repTimeline ?? []).length > 0) {
      const reps = new Map((result.repTimeline ?? []).map((rep) => [rep.repNumber, rep]));
      for (const finding of findings) {
        for (const evidence of finding.evidence) {
          if (evidence.repNumber === null) continue;
          const rep = reps.get(evidence.repNumber);
          const peak = evidence.peakMs ?? evidence.startMs;
          if (!rep || peak < rep.startMs - EVIDENCE_REP_TOLERANCE_MS || peak > rep.endMs + EVIDENCE_REP_TOLERANCE_MS) context.addIssue({ code: "custom", path: ["repTimeline"], message: "Finding evidence must stay within one second of its referenced repetition" });
        }
      }
    }

    if (result.status === "unable") {
      if (result.videoCheck.outcome !== "unable") {
        context.addIssue({ code: "custom", path: ["videoCheck", "outcome"], message: "Unable results require an unable video check" });
      }
      if (!result.videoCheck.retryReason || !result.videoCheck.retryInstruction) {
        context.addIssue({ code: "custom", path: ["videoCheck"], message: "Unable results require one reason and retry instruction" });
      }
      if (result.score !== null || result.scoreRationale.length > 0) {
        context.addIssue({ code: "custom", path: ["score"], message: "Unable results cannot include a score" });
      }
      if ((result.movementScores ?? []).length > 0) {
        context.addIssue({ code: "custom", path: ["movementScores"], message: "Unable results cannot include movement scores" });
      }
      if (findings.length > 0) {
        context.addIssue({ code: "custom", path: ["priorityCorrections"], message: "Unable results cannot include coaching findings" });
      }
      if ((result.equipmentObservations ?? []).length > 0) {
        context.addIssue({ code: "custom", path: ["equipmentObservations"], message: "Unable results cannot include equipment observations" });
      }
      return;
    }

    if (result.videoCheck.outcome === "unable") {
      context.addIssue({ code: "custom", path: ["videoCheck", "outcome"], message: "Analyzed results require a usable or partial video check" });
    }
    if (!result.overallAssessment) {
      context.addIssue({ code: "custom", path: ["overallAssessment"], message: "Analyzed results require an overall assessment" });
    }
    if (result.score === null) {
      context.addIssue({ code: "custom", path: ["score"], message: "Analyzed results require a numeric score" });
    }
    for (const [index, finding] of result.priorityCorrections.entries()) {
      if (!finding.actionableCorrection) {
        context.addIssue({ code: "custom", path: ["priorityCorrections", index, "actionableCorrection"], message: "Every priority issue requires complete what-to-do-next coaching" });
      }
    }
    const correctionIds = new Set(result.priorityCorrections.map((finding) => finding.id));
    for (const [index, coverage] of (result.coachingCoverage ?? []).entries()) {
      if (coverage.status === "issue" && coverage.findingIds.length === 0) {
        context.addIssue({ code: "custom", path: ["coachingCoverage", index, "findingIds"], message: "Issue coverage must reference a correction" });
      }
      if (coverage.status !== "issue" && coverage.findingIds.length > 0) {
        context.addIssue({ code: "custom", path: ["coachingCoverage", index, "findingIds"], message: "Clear or not-visible coverage cannot reference corrections" });
      }
      for (const findingId of coverage.findingIds) {
        if (!correctionIds.has(findingId)) context.addIssue({ code: "custom", path: ["coachingCoverage", index, "findingIds"], message: "Coverage references an unknown correction" });
      }
    }
    for (const findingId of result.exerciseGuide?.relatedFindingIds ?? []) {
      if (!correctionIds.has(findingId)) context.addIssue({ code: "custom", path: ["exerciseGuide", "relatedFindingIds"], message: "Exercise guide references an unknown correction" });
    }
    for (const [index, plan] of (result.nextSetPlan ?? []).entries()) {
      if (!plan.relatedFindingId || !correctionIds.has(plan.relatedFindingId)) {
        context.addIssue({ code: "custom", path: ["nextSetPlan", index, "relatedFindingId"], message: "Every next-set action must reference a real correction" });
      }
    }
    if (result.priorityCorrections.length > 0 && (result.nextSetPlan ?? []).length === 0) {
      context.addIssue({ code: "custom", path: ["nextSetPlan"], message: "Corrections require at least one next-set action" });
    }
    if (!result.recognition.label) context.addIssue({ code: "custom", path: ["recognition", "label"], message: "Analyzed results require an exercise label" });
  });

export type ScoreRationale = z.infer<typeof scoreRationaleSchema>;
export type MovementScore = z.infer<typeof movementScoreSchema>;
export type AnatomyRegion = (typeof anatomyRegions)[number];
export type TechniqueScorecard = z.infer<typeof techniqueScorecardSchema>;
export type EquipmentObservation = z.infer<typeof equipmentObservationSchema>;
export type EvidenceMoment = z.infer<typeof evidenceMomentSchema>;
export type VisualFocusRegion = z.infer<typeof visualFocusRegionSchema>;
export type CoachingFinding = z.infer<typeof coachingFindingSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type MuscleFocus = AnalysisResult["muscleFocus"];
export type MuscleRegion = (typeof muscleRegions)[number];
export type RepTimelineItem = z.infer<typeof repTimelineItemSchema>;
export type NextSetPlanItem = z.infer<typeof nextSetPlanItemSchema>;
