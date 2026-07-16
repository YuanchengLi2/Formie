import { z } from "zod";
import { exerciseFamilies } from "@/features/exercises/exercise-family";

const scoreRationaleSchema = z.object({
  criterion: z.string().min(1),
  observed: z.string().min(1),
  impact: z.number().min(0).max(100),
  confidence: z.number().min(0.75).max(1),
});

export const evidenceMomentSchema = z
  .object({
    startMs: z.number().int().min(0),
    peakMs: z.number().int().min(0).optional(),
    endMs: z.number().int().positive(),
    repNumber: z.number().int().positive().nullable(),
    phase: z.string().min(1).nullable(),
    visualEvidence: z.string().min(1),
    visibleBodyAreas: z.array(z.string().min(1)).min(1),
    confidence: z.number().min(0.75).max(1),
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
    comparison: comparisonSchema.nullable(),
  })
  .superRefine((result, context) => {
    const findings = [...result.didWell, ...result.priorityCorrections, ...result.coachingCues];

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
export type CoachingFinding = z.infer<typeof coachingFindingSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
