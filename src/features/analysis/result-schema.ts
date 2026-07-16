import { z } from "zod";
import { exerciseFamilies } from "@/features/exercises/exercise-family";

const scoreRationaleSchema = z.object({
  criterion: z.string().min(1),
  observed: z.string().min(1),
  impact: z.number().min(0).max(100),
  confidence: z.number().min(0.75).max(1),
});

export const visualFocusRegionSchema = z.object({
  centerX: z.number().min(0).max(1),
  centerY: z.number().min(0).max(1),
  radius: z.number().min(0.06).max(0.3),
  arrowFromX: z.number().min(0).max(1),
  arrowFromY: z.number().min(0).max(1),
  label: z.string().min(1),
  confidence: z.number().min(0.8).max(1),
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
    confidence: z.number().min(0.75).max(1),
    focusRegion: visualFocusRegionSchema.nullable().optional(),
  })
  .refine((moment) => moment.endMs > moment.startMs, {
    message: "Evidence end time must follow its start time",
    path: ["endMs"],
  })
  .refine((moment) => moment.peakMs === undefined || (moment.peakMs >= moment.startMs && moment.peakMs <= moment.endMs), { message: "Evidence peak must fall inside its interval", path: ["peakMs"] });

export const coachingFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  whyItMatters: z.string().min(1),
  correction: z.string().min(1).nullable(),
  cue: z.string().min(1).nullable(),
  severity: z.enum(["note", "important", "high"]),
  evidence: z.array(evidenceMomentSchema).min(1),
});

const recognitionSchema = z.object({
  label: z.string().min(1).nullable(),
  variation: z.string().min(1).nullable(),
  equipment: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.string().min(1)),
  catalogExerciseId: z.number().int().positive().nullable(),
  exerciseFamily: z.enum(exerciseFamilies),
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
  relatedFindingId: z.string().min(1).nullable(),
});

const usageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  thinkingTokens: z.number().int().nonnegative(),
});

const verificationSchema = z.object({
  performed: z.boolean(),
  reason: z.string().min(1).nullable(),
  outcome: z.enum(["not-needed", "confirmed", "revised", "rejected", "failed"]),
  checkedFindingId: z.string().min(1).nullable(),
  usage: usageSchema.optional(),
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

const precisionReviewSchema = z.object({
  runsRequested: z.number().int().min(0).max(3),
  runsUsed: z.number().int().min(0).max(3),
  status: z.enum(["not-needed", "completed", "partial", "failed"]),
  summary: z.string().min(1).nullable(),
  passes: z.array(z.object({
    passNumber: z.number().int().positive(),
    kind: z.enum(["recognition", "timestamp", "technique"]),
    outcome: z.enum(["confirmed", "revised", "rejected", "inconclusive", "failed"]),
    reason: z.string().min(1),
    checkedFindingId: z.string().min(1).nullable(),
    startMs: z.number().int().nonnegative().nullable(),
    endMs: z.number().int().positive().nullable(),
    usage: usageSchema,
  })).max(3),
});

export const analysisResultSchema = z
  .object({
    status: z.enum(["complete", "partial", "unable"]),
    recognition: recognitionSchema,
    videoCheck: videoCheckSchema,
    overallAssessment: z.string().min(1).nullable(),
    score: z.number().min(0).max(100).nullable(),
    scoreRationale: z.array(scoreRationaleSchema),
    didWell: z.array(coachingFindingSchema),
    priorityCorrections: z.array(coachingFindingSchema),
    coachingCues: z.array(coachingFindingSchema),
    setSummary: setSummarySchema.optional(),
    repTimeline: z.array(repTimelineItemSchema).optional(),
    nextSetPlan: z.array(nextSetPlanItemSchema).max(5).optional(),
    precisionRequest: precisionRequestSchema.optional(),
    precisionReview: precisionReviewSchema.optional(),
    verification: verificationSchema.optional(),
    comparison: comparisonSchema.nullable(),
  })
  .superRefine((result, context) => {
    const findings = [...result.didWell, ...result.priorityCorrections, ...result.coachingCues];
    const review = result.precisionReview;
    if (review) {
      const failedPasses = review.passes.filter((pass) => pass.outcome === "failed").length;
      if (review.runsUsed !== review.passes.length) context.addIssue({ code: "custom", path: ["precisionReview", "runsUsed"], message: "Premium runs used must match recorded passes" });
      if (review.runsUsed > review.runsRequested) context.addIssue({ code: "custom", path: ["precisionReview", "runsUsed"], message: "Premium runs used cannot exceed requested runs" });
      if (review.status === "not-needed" && (review.runsRequested !== 0 || review.runsUsed !== 0)) context.addIssue({ code: "custom", path: ["precisionReview", "status"], message: "A not-needed review cannot use runs" });
      if (review.status === "completed" && (review.runsUsed !== review.runsRequested || failedPasses > 0)) context.addIssue({ code: "custom", path: ["precisionReview", "status"], message: "A completed review requires every requested pass" });
      if (review.status === "partial" && (failedPasses === 0 || failedPasses === review.passes.length)) context.addIssue({ code: "custom", path: ["precisionReview", "status"], message: "A partial review requires successful and failed passes" });
      if (review.status === "failed" && review.passes.length > 0 && failedPasses === 0) context.addIssue({ code: "custom", path: ["precisionReview", "status"], message: "A failed review requires a failed pass" });
    }
    if ((result.repTimeline ?? []).length > 0) {
      const reps = new Map((result.repTimeline ?? []).map((rep) => [rep.repNumber, rep]));
      for (const finding of findings) {
        for (const evidence of finding.evidence) {
          if (evidence.repNumber === null) continue;
          const rep = reps.get(evidence.repNumber);
          const peak = evidence.peakMs ?? evidence.startMs;
          if (!rep || peak < rep.startMs || peak > rep.endMs) context.addIssue({ code: "custom", path: ["repTimeline"], message: "Finding evidence must fall inside its referenced repetition" });
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
      if (findings.length > 0) {
        context.addIssue({ code: "custom", path: ["priorityCorrections"], message: "Unable results cannot include coaching findings" });
      }
      if (result.overallAssessment !== null) {
        context.addIssue({ code: "custom", path: ["overallAssessment"], message: "Unable results cannot include a technique assessment" });
      }
      return;
    }

    if (result.videoCheck.outcome === "unable") {
      context.addIssue({ code: "custom", path: ["videoCheck", "outcome"], message: "Analyzed results require a usable or partial video check" });
    }
    if (!result.overallAssessment) {
      context.addIssue({ code: "custom", path: ["overallAssessment"], message: "Analyzed results require an overall assessment" });
    }
    if ((result.nextSetPlan ?? []).length === 0) {
      context.addIssue({ code: "custom", path: ["nextSetPlan"], message: "Analyzed results require at least one next-set action" });
    }

    if (result.score !== null) {
      if (!result.recognition.label || result.recognition.confidence < 0.55) {
        context.addIssue({ code: "custom", path: ["score"], message: "A score requires confident exercise recognition" });
      }
      if (result.scoreRationale.length < 2) {
        context.addIssue({ code: "custom", path: ["scoreRationale"], message: "A score requires at least two supported criteria" });
      }
    } else if (result.scoreRationale.length > 0) {
      context.addIssue({ code: "custom", path: ["scoreRationale"], message: "Score rationale must be empty when no score is shown" });
    }
    if (!result.recognition.label) context.addIssue({ code: "custom", path: ["recognition", "label"], message: "Analyzed results require an exercise label" });
  });

export type ScoreRationale = z.infer<typeof scoreRationaleSchema>;
export type EvidenceMoment = z.infer<typeof evidenceMomentSchema>;
export type VisualFocusRegion = z.infer<typeof visualFocusRegionSchema>;
export type CoachingFinding = z.infer<typeof coachingFindingSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type RepTimelineItem = z.infer<typeof repTimelineItemSchema>;
export type NextSetPlanItem = z.infer<typeof nextSetPlanItemSchema>;
export type PrecisionReview = z.infer<typeof precisionReviewSchema>;
