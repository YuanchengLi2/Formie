import { z } from "zod";

const scoreRationaleSchema = z.object({
  criterion: z.string().min(1),
  observed: z.string().min(1),
  impact: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
});

const analysisIssueSchema = z
  .object({
    title: z.string().min(1),
    whatWentWrong: z.string().min(1),
    whatToImprove: z.string().min(1),
    startMs: z.number().int().min(0),
    endMs: z.number().int().positive(),
    repNumber: z.number().int().positive().nullable(),
    visualEvidence: z.string().min(1),
    poseEvidence: z.string().min(1).nullable(),
    severity: z.enum(["low", "medium", "high"]),
    confidence: z.number().min(0.75).max(1),
    observableLandmarks: z.array(z.string().min(1)).min(1),
  })
  .refine((issue) => issue.endMs > issue.startMs, {
    message: "Issue end time must follow its start time",
    path: ["endMs"],
  });

export const analysisResultSchema = z
  .object({
    status: z.enum(["complete", "partial", "unable"]),
    score: z.number().min(0).max(100).nullable(),
    scoreRationale: z.array(scoreRationaleSchema),
    issues: z.array(analysisIssueSchema).max(3),
    noMajorIssueSummary: z.string().min(1).nullable(),
    nextRefinement: z.string().min(1).nullable(),
    retryInstruction: z.string().min(1).nullable(),
  })
  .superRefine((result, context) => {
    if (result.status === "unable") {
      if (result.score !== null) {
        context.addIssue({ code: "custom", path: ["score"], message: "Unable results cannot include a score" });
      }
      if (result.scoreRationale.length > 0) {
        context.addIssue({ code: "custom", path: ["scoreRationale"], message: "Unable results cannot include score rationale" });
      }
      if (result.issues.length > 0) {
        context.addIssue({ code: "custom", path: ["issues"], message: "Unable results cannot include technique issues" });
      }
      if (!result.retryInstruction) {
        context.addIssue({ code: "custom", path: ["retryInstruction"], message: "Unable results require one retry instruction" });
      }
      return;
    }

    if (result.score !== null && result.scoreRationale.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["scoreRationale"],
        message: "A visible score requires at least two supported criteria",
      });
    }

    if (result.status === "complete" && result.score === null) {
      context.addIssue({ code: "custom", path: ["score"], message: "Complete results require a score" });
    }

    if (result.issues.length === 0 && (!result.noMajorIssueSummary || !result.nextRefinement)) {
      context.addIssue({
        code: "custom",
        path: ["issues"],
        message: "A result without issues must include a no-major-issue summary and next refinement",
      });
    }
  });

export type ScoreRationale = z.infer<typeof scoreRationaleSchema>;
export type AnalysisIssue = z.infer<typeof analysisIssueSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
