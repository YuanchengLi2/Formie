import { estimateGeminiCost, type GeminiUsage } from "./gemini-cost.ts";

type TelemetryInsert = {
  insert(values: Record<string, unknown>): PromiseLike<{ error?: { message?: string } | null }>;
};

export type ModelTelemetryClient = {
  from(table: "model_call_telemetry"): TelemetryInsert;
};

export type ModelCallTelemetry = {
  sessionId: string;
  analysisAttemptId?: string | null;
  v49RunId?: string | null;
  stageRunId?: string | null;
  stage: string;
  model: string;
  requestedFps?: number | null;
  clipStartMs?: number | null;
  clipEndMs?: number | null;
  startedAtMs: number;
  usage?: GeminiUsage;
  status: "succeeded" | "failed";
  errorCode?: string | null;
  pricedAt?: Date;
};

export async function recordModelCallTelemetry(
  client: ModelTelemetryClient,
  input: ModelCallTelemetry,
): Promise<boolean> {
  const pricedAt = input.pricedAt ?? new Date();
  const estimate = estimateGeminiCost(input.model, input.usage, pricedAt);
  const coverage = !input.usage ? "missing_usage" : !estimate.price ? "unpriced_model" : "complete";
  const { error } = await client.from("model_call_telemetry").insert({
    session_id: input.sessionId,
    analysis_attempt_id: input.analysisAttemptId ?? null,
    v49_run_id: input.v49RunId ?? null,
    stage_run_id: input.stageRunId ?? null,
    stage: input.stage,
    model: input.model,
    requested_fps: input.requestedFps ?? null,
    clip_start_ms: input.clipStartMs ?? null,
    clip_end_ms: input.clipEndMs ?? null,
    prompt_tokens: input.usage?.promptTokens ?? null,
    output_tokens: input.usage?.outputTokens ?? null,
    thinking_tokens: input.usage?.thinkingTokens ?? null,
    estimated_cost_usd: estimate.costUsd,
    pricing_version: estimate.price?.version ?? null,
    pricing_source: estimate.price?.source ?? null,
    pricing_effective_at: estimate.price?.effectiveAt ?? null,
    pricing_coverage: coverage,
    duration_ms: Math.max(0, Date.now() - input.startedAtMs),
    status: input.status,
    error_code: input.errorCode ?? null,
  });
  if (!error) return true;
  console.error(JSON.stringify({
    context: "MODEL_CALL_TELEMETRY_SAVE_FAILED",
    sessionId: input.sessionId,
    attemptId: input.analysisAttemptId ?? null,
    stage: input.stage,
    model: input.model,
    message: error.message ?? "Unknown telemetry persistence error",
  }));
  return false;
}
