export type TimedAnalysisStage = "analyzing" | "finalizing";

const SERVER_BUDGET_MS = 120_000;

export function analysisDeadlineStartedAt(input: {
  invocationStartedAt: number;
  persistedStartedAt: number | null;
  pipelineVersion: string | null;
  stage: string | null;
}): number {
  if (input.pipelineVersion !== "gemini-whole-video-v46" && input.pipelineVersion !== "gemini-whole-video-v47") {
    return input.invocationStartedAt;
  }
  if (input.stage === "video_processing" || input.stage === "input_ready") return input.invocationStartedAt;
  return input.persistedStartedAt ?? input.invocationStartedAt;
}

export class AnalysisDeadline {
  readonly deadlineMs: number;

  constructor(startedAtMs: number) {
    this.deadlineMs = startedAtMs + SERVER_BUDGET_MS;
  }

  remainingMs(nowMs = Date.now()): number {
    return Math.max(0, this.deadlineMs - nowMs);
  }

  timeoutFor(stage: TimedAnalysisStage, nowMs = Date.now()): number {
    const stageLimitMs = stage === "finalizing" ? 30_000 : 115_000;
    return Math.max(0, Math.min(stageLimitMs, this.remainingMs(nowMs)));
  }
}
