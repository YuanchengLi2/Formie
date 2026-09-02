import type { AnalysisCandidate, ExerciseFamily } from "../_shared/analysis-contract.ts";
import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { requireCurrentAiEligibility } from "../_shared/ai-eligibility.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { constantTimeEqual } from "../_shared/request-security.ts";
import { estimatedGeminiCost } from "../_shared/gemini-cost.ts";
import { buildTextGenerateContentRequest, buildVideoGenerateContentRequest, createGenerateContentClient } from "../_shared/gemini-generate.ts";
import { geminiGovernanceFromEnvironment } from "../_shared/gemini-governance.ts";
import { parseSetDeclaration, type SetDeclaration } from "../_shared/set-declaration.ts";
import { analyzeVideoV49Handler, type V49Run } from "./handler.ts";
import { canonicalSha256 } from "./canonical-json.ts";
import { buildProblemFinderPrompt, parseProblemFinderResult, PROBLEM_FINDER_SCHEMA, type ProblemFinderProblem, type ProblemFinderResult, type UnableReason } from "./problem-finder.ts";
import { buildCoachingWriterPrompt, COACHING_WRITER_SCHEMA, parseCoachingWriterResult, type CatalogContext, type CoachingWriterResult } from "./coaching-writer.ts";
import { mapV49Result } from "./result-mapper.ts";
import { runV49Pipeline } from "./pipeline-runner.ts";
import { prepareV49InlineVideo, selectV49VideoPath, type PreparedV49InlineVideo } from "./video-input.ts";
import {
  V49_ANALYSIS_TIMEOUT_MS,
  V49_ANALYST_MODEL,
  V49_ANALYST_THINKING_LEVEL,
  V49_MEDIA_RESOLUTION,
  V49_PIPELINE_VERSION,
  V49_REQUESTED_FPS,
  V49_WRITER_MODEL,
  V49_WRITER_THINKING_LEVEL,
} from "./config.ts";

type JsonRecord = Record<string, unknown>;
type StageName = "problem_finder" | "coaching_writer" | "commit";
type StageClaim = { resultStatus: "claimed" | "succeeded" | "busy" | "failed"; stageRunId: string; leaseToken: string; output: unknown };
type LoadedRun = V49Run & {
  status: string;
  stage: string;
  declarationSnapshot: unknown;
  publicResult: unknown;
  failureReason: unknown;
  videoPath: string | null;
  analysisVideoPath: string | null;
  analysisInputStrategy: string | null;
  durationMs: number;
  catalogExerciseId: number | null;
};

const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
const governance = geminiGovernanceFromEnvironment((name) => Deno.env.get(name));
const generation = createGenerateContentClient({ apiKey, governance });

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function row(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as JsonRecord : null;
  return value && typeof value === "object" ? value as JsonRecord : null;
}

function codeFor(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") return String((error as { code: string }).code).slice(0, 64);
  return "ANALYSIS_CONTRACT_INVALID";
}

async function stageClaim(admin: ReturnType<typeof createAdminClient>, runId: string, stage: StageName, input: unknown): Promise<StageClaim> {
  const inputHash = await canonicalSha256(input);
  const { data, error } = await admin.rpc("claim_analysis_v49_stage", { p_run_id: runId, p_stage: stage, p_input_hash: inputHash, p_lease_seconds: 120 });
  if (error) throw error;
  const claim = row(data);
  if (!claim) throw Object.assign(new Error("v49 stage claim returned no row"), { code: "ANALYSIS_STAGE_CLAIM_FAILED" });
  return { resultStatus: String(claim.result_status) as StageClaim["resultStatus"], stageRunId: String(claim.stage_run_id), leaseToken: String(claim.lease_token), output: claim.output };
}

async function runStage<T>(admin: ReturnType<typeof createAdminClient>, runId: string, stage: StageName, input: unknown, work: () => Promise<T>): Promise<T> {
  const claim = await stageClaim(admin, runId, stage, input);
  if (claim.resultStatus === "succeeded") return claim.output as T;
  if (claim.resultStatus === "failed") throw Object.assign(new Error(`${stage} previously failed structural validation`), { code: "ANALYSIS_DETERMINISTIC_STAGE_FAILED" });
  if (claim.resultStatus !== "claimed") throw Object.assign(new Error(`${stage} is already running`), { code: "ANALYSIS_STAGE_BUSY" });
  try {
    const output = await work();
    const { data, error } = await admin.rpc("complete_analysis_v49_stage", { p_stage_run_id: claim.stageRunId, p_lease_token: claim.leaseToken, p_output: output });
    if (error || data !== true) throw Object.assign(error ?? new Error("v49 stage completion lost its lease"), { code: "ANALYSIS_STAGE_COMPLETION_FAILED" });
    return output;
  } catch (error) {
    try {
      const failed = await admin.rpc("fail_analysis_v49_stage", { p_stage_run_id: claim.stageRunId, p_lease_token: claim.leaseToken, p_error_code: codeFor(error) });
      if (failed.error) console.error(JSON.stringify({ code: "V49_STAGE_FAILURE_PERSIST_FAILED", message: failed.error.message }));
    } catch (persistenceError) {
      console.error(JSON.stringify({ code: "V49_STAGE_FAILURE_PERSIST_FAILED", message: persistenceError instanceof Error ? persistenceError.message : String(persistenceError) }));
    }
    throw error;
  }
}

async function inlineVideo(session: LoadedRun, admin: ReturnType<typeof createAdminClient>): Promise<PreparedV49InlineVideo> {
  const path = selectV49VideoPath(session);
  const { data: video, error } = await admin.storage.from("analysis-videos").download(path);
  if (error || !video) throw Object.assign(error ?? new Error("Analysis video download returned no data"), { code: "ANALYSIS_VIDEO_DOWNLOAD_FAILED" });
  try {
    return await prepareV49InlineVideo(video);
  } catch (preparationError) {
    throw Object.assign(preparationError instanceof Error ? preparationError : new Error(String(preparationError)), { code: "ANALYSIS_VIDEO_PREPARATION_FAILED" });
  }
}

async function recordModelCall(admin: ReturnType<typeof createAdminClient>, input: { run: LoadedRun; model: string; startedAt: number; usage?: { promptTokens: number; outputTokens: number; thinkingTokens: number }; status: "succeeded" | "failed"; errorCode?: string }): Promise<void> {
  await admin.from("model_call_telemetry").insert({
    session_id: input.run.sessionId,
    v49_run_id: input.run.runId,
    stage: "analyzing",
    model: input.model,
    requested_fps: input.model === V49_ANALYST_MODEL ? V49_REQUESTED_FPS : null,
    prompt_tokens: input.usage?.promptTokens ?? null,
    output_tokens: input.usage?.outputTokens ?? null,
    thinking_tokens: input.usage?.thinkingTokens ?? null,
    estimated_cost_usd: estimatedGeminiCost(input.model, input.usage),
    duration_ms: Math.max(0, Date.now() - input.startedAt),
    status: input.status,
    error_code: input.errorCode ?? null,
  }).then(() => undefined).catch(() => undefined);
}

async function generate(admin: ReturnType<typeof createAdminClient>, run: LoadedRun, model: string, request: Parameters<typeof generation.generate>[1]): Promise<unknown> {
  const startedAt = Date.now();
  try {
    const response = await generation.generate(model, request, { timeoutMs: V49_ANALYSIS_TIMEOUT_MS });
    await recordModelCall(admin, { run, model, startedAt, usage: response.usage, status: "succeeded" });
    return response.value;
  } catch (error) {
    await recordModelCall(admin, { run, model, startedAt, status: "failed", errorCode: codeFor(error) });
    throw error;
  }
}

function family(value: unknown): ExerciseFamily | null {
  const allowed = new Set<ExerciseFamily>(["curl", "triceps", "press", "overhead-press", "fly", "raise", "row", "pull-down", "squat", "lunge", "hinge", "hip-thrust", "carry", "core", "plank", "other"]);
  return typeof value === "string" && allowed.has(value as ExerciseFamily) ? value as ExerciseFamily : null;
}

async function catalogContext(admin: ReturnType<typeof createAdminClient>, declaration: SetDeclaration): Promise<CatalogContext> {
  if (declaration.exercise.catalogExerciseId === null) return { canonicalLabel: declaration.exercise.label, family: null, equipment: [] };
  const { data, error } = await admin.from("exercise_variants_v2").select("name,family,mechanics").eq("id", declaration.exercise.catalogExerciseId).maybeSingle();
  if (error) throw error;
  const mechanics = data?.mechanics && typeof data.mechanics === "object" && !Array.isArray(data.mechanics) ? data.mechanics as JsonRecord : {};
  const equipmentClass = typeof mechanics.equipmentClass === "string" && mechanics.equipmentClass.trim() ? [mechanics.equipmentClass.trim()] : [];
  return { canonicalLabel: typeof data?.name === "string" ? data.name : declaration.exercise.label, family: family(data?.family), equipment: equipmentClass };
}

async function executeRun(run: LoadedRun, admin: ReturnType<typeof createAdminClient>) {
  if (run.status === "complete" && run.publicResult) return { status: "complete", stage: "complete", result: run.publicResult };
  if (run.status === "unable") return { status: "unable", stage: "unable", failureReason: run.failureReason };
  const declaration = parseSetDeclaration(run.declarationSnapshot);
  const context = await catalogContext(admin, declaration);
  let foundOutput: ProblemFinderResult | null = null;
  let writtenOutput: CoachingWriterResult | null = null;
  try {
    const pipeline = await runV49Pipeline({ runId: run.runId }, {
      findProblems: async () => {
        await admin.from("analysis_v49_runs").update({ status: "processing", stage: "problem_finding", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("run_id", run.runId);
        const prepared = await inlineVideo(run, admin);
        foundOutput = await runStage(admin, run.runId, "problem_finder", { videoPath: selectV49VideoPath(run), videoSha256: prepared.sha256, videoByteLength: prepared.byteLength, durationMs: run.durationMs, declaration, fps: V49_REQUESTED_FPS, resolution: V49_MEDIA_RESOLUTION, model: V49_ANALYST_MODEL }, async () => {
          const raw = await generate(admin, run, V49_ANALYST_MODEL, buildVideoGenerateContentRequest({
            video: prepared.video,
            prompt: buildProblemFinderPrompt(run.durationMs, declaration),
            schema: PROBLEM_FINDER_SCHEMA,
            preserveSchemaBounds: true,
            fps: V49_REQUESTED_FPS,
            thinkingLevel: V49_ANALYST_THINKING_LEVEL,
            mediaResolution: V49_MEDIA_RESOLUTION,
          }));
          const rawPersisted = await admin.from("analysis_v49_runs").update({ raw_problem_output: raw, updated_at: new Date().toISOString() }).eq("run_id", run.runId);
          if (rawPersisted.error) throw rawPersisted.error;
          return parseProblemFinderResult(raw, run.durationMs);
        });
        return foundOutput;
      },
      writeCoaching: async (problems) => {
        await admin.from("analysis_v49_runs").update({ stage: "coaching", raw_problem_output: foundOutput, updated_at: new Date().toISOString() }).eq("run_id", run.runId);
        writtenOutput = await runStage(admin, run.runId, "coaching_writer", { declaration, catalogContext: context, problems, model: V49_WRITER_MODEL }, async () => {
          const typedProblems = problems as ProblemFinderProblem[];
          const raw = await generate(admin, run, V49_WRITER_MODEL, buildTextGenerateContentRequest({ prompt: buildCoachingWriterPrompt({ declaration, catalogContext: context, problems: typedProblems }), schema: COACHING_WRITER_SCHEMA, thinkingLevel: V49_WRITER_THINKING_LEVEL }));
          const rawPersisted = await admin.from("analysis_v49_runs").update({ raw_writer_output: raw, updated_at: new Date().toISOString() }).eq("run_id", run.runId);
          if (rawPersisted.error) throw rawPersisted.error;
          return parseCoachingWriterResult(raw, typedProblems);
        });
        return writtenOutput;
      },
      mapResult: (problems, writing) => mapV49Result({ declaration, catalogContext: context, problems: problems as ProblemFinderProblem[], writing: writing as CoachingWriterResult }),
      commitResult: async (_runId, result) => {
        await admin.from("analysis_v49_runs").update({ stage: "committing", raw_writer_output: writtenOutput, updated_at: new Date().toISOString() }).eq("run_id", run.runId);
        await runStage(admin, run.runId, "commit", { result }, async () => {
          const { data, error } = await admin.rpc("commit_analysis_v49_result", { p_run_id: run.runId, p_problem_output: foundOutput, p_writer_output: writtenOutput, p_public_result: result });
          if (error || data !== true) throw error ?? new Error("v49 result commit failed");
          return result;
        });
      },
      failUnable: async (_runId, reason: UnableReason) => {
        await admin.from("analysis_v49_runs").update({ raw_problem_output: foundOutput, updated_at: new Date().toISOString() }).eq("run_id", run.runId);
        const { error } = await admin.rpc("mark_analysis_v49_unable", { p_run_id: run.runId, p_reason: reason });
        if (error) throw error;
      },
    });
    if (pipeline.status === "unable") return { status: "unable", stage: "unable", failureReason: pipeline.reason };
    return { status: "complete", stage: "complete", result: pipeline.result as AnalysisCandidate };
  } catch (error) {
    const code = codeFor(error);
    if (code === "ANALYSIS_CONTRACT_INVALID" || code === "ANALYSIS_DETERMINISTIC_STAGE_FAILED") {
      await admin.rpc("fail_analysis_v49_run", { p_run_id: run.runId, p_error_code: code, p_reason: { code, message: error instanceof Error ? error.message : String(error) } });
    }
    throw error;
  } finally {
    try {
      const counted = await admin.from("model_call_telemetry").select("id", { count: "exact", head: true }).eq("v49_run_id", run.runId);
      if (counted.error) throw counted.error;
      const updated = await admin.from("analysis_v49_runs").update({ model_call_count: counted.count ?? 0, updated_at: new Date().toISOString() }).eq("run_id", run.runId);
      if (updated.error) throw updated.error;
    } catch (telemetryError) {
      console.error(JSON.stringify({ code: "V49_CALL_COUNT_PERSIST_FAILED", message: telemetryError instanceof Error ? telemetryError.message : String(telemetryError) }));
    }
  }
}

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "service", maxBodyBytes: 8_192 });
  if (security) return security;
  const admin = createAdminClient();
  try {
    return withCors(request, await analyzeVideoV49Handler(request, {
      authenticate: async (incoming) => {
        const retrySecret = incoming.headers.get("x-analysis-retry-secret");
        const configuredRetrySecret = Deno.env.get("ANALYSIS_RETRY_SECRET") ?? Deno.env.get("RETENTION_CLEANUP_SECRET");
        if (configuredRetrySecret && retrySecret && constantTimeEqual(retrySecret, configuredRetrySecret)) {
          const userId = incoming.headers.get("x-analysis-retry-user-id");
          if (!userId) throw new Error("UNAUTHORIZED");
          await requireCurrentAiEligibility(admin, userId);
          return { userId, allowShadow: false };
        }
        const supplied = incoming.headers.get("x-analysis-shadow-secret");
        const configured = Deno.env.get("ANALYSIS_SHADOW_SECRET");
        if (configured && supplied && constantTimeEqual(supplied, configured)) {
          const userId = incoming.headers.get("x-analysis-shadow-user-id");
          if (!userId) throw new Error("UNAUTHORIZED");
          await requireCurrentAiEligibility(admin, userId);
          return { userId, allowShadow: true };
        }
        const userId = await requireUserId(incoming, admin);
        await requireCurrentAiEligibility(admin, userId);
        return { userId, allowShadow: false };
      },
      loadRun: async (sessionId, userId, requestedRunId) => {
        const { data: session, error: sessionError } = await admin.from("analysis_sessions").select("id,user_id,active_v49_run_id,video_path,analysis_video_path,analysis_input_strategy,duration_ms,exercise_variant_v2_id").eq("id", sessionId).eq("user_id", userId).maybeSingle();
        if (sessionError) throw sessionError;
        if (!session) return null;
        const runId = requestedRunId ?? session.active_v49_run_id;
        if (!runId) return null;
        const { data: run, error: runError } = await admin.from("analysis_v49_runs").select("*").eq("run_id", runId).eq("session_id", sessionId).eq("user_id", userId).maybeSingle();
        if (runError) throw runError;
        if (!run) return null;
        return { runId: run.run_id, sessionId, userId, mode: run.mode, status: run.status, stage: run.stage, declarationSnapshot: run.declaration_snapshot, publicResult: run.public_result, failureReason: run.failure_reason, videoPath: session.video_path, analysisVideoPath: session.analysis_video_path, analysisInputStrategy: session.analysis_input_strategy, durationMs: session.duration_ms, catalogExerciseId: session.exercise_variant_v2_id } as LoadedRun;
      },
      execute: (run) => executeRun(run as LoadedRun, admin),
    }));
  } catch (error) {
    const code = codeFor(error);
    if (code === "ANALYSIS_STAGE_BUSY") return withCors(request, json({ status: "processing", stage: "processing", code }, 202));
    console.error(JSON.stringify({ code, message: error instanceof Error ? error.message : String(error) }));
    return withCors(request, json({ message: "Analysis failed", code }, 500));
  }
});
