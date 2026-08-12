import type { AnalysisCandidate } from "../_shared/analysis-contract.ts";
import {
  ANALYST_THINKING_LEVEL,
  REQUESTED_ANALYSIS_FPS,
  REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
} from "../_shared/analysis-settings.ts";
import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { buildVideoGenerateContentRequest, createGenerateContentClient } from "../_shared/gemini-generate.ts";
import { createGeminiFilesClient, reuseOrUploadGeminiFile, type GeminiFile } from "../_shared/gemini-files.ts";
import {
  buildBoundaryFreeAnalysisPrompt,
  parseBoundaryFreeAnalysis,
  parseWholeVideoWriting,
  BOUNDARY_FREE_ANALYSIS_SCHEMA,
  boundaryFreeToCandidate,
} from "../_shared/boundary-free-analysis.ts";
import type { ExerciseFamily } from "../_shared/analysis-contract.ts";
import { resultPayload } from "../_shared/result-payload.ts";
import { estimatedGeminiCost } from "../_shared/gemini-cost.ts";
import { parseSetDeclaration } from "../_shared/set-declaration.ts";
import { selectGeminiVideoPath } from "./analysis-input.ts";
import { advanceWholeVideoPipeline } from "./whole-video-runner.ts";
import { analyzeWholeVideoHandler, type WholeVideoSession } from "./whole-video-handler.ts";
import { AnalysisDeadline, analysisDeadlineStartedAt } from "./analysis-deadline.ts";
import { runClaimedStage, stageFailurePersistenceError } from "./stage-execution.ts";

const PIPELINE_VERSION = "gemini-whole-video-v66-original-coaching-provider-compatible";
const MAX_DURABLE_RETRIES = 3;
const ANALYST_MODEL = "gemini-3.6-flash";
const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
const files = createGeminiFilesClient({ apiKey });
const generation = createGenerateContentClient({ apiKey });

type JsonRecord = Record<string, unknown>;
type WholeVideoInput = { uri: string; mimeType: string } | { kind: "inline"; data: string; mimeType: string };
type StageName = "analyzing" | "finalizing";
type ModelCallStage = StageName;
type StageClaim = { resultStatus: string; stageRunId: string; leaseToken: string; output: unknown };

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "");
    if (/^[A-Z][A-Z0-9_]{2,63}$/.test(code)) return code;
  }
  return error instanceof Error ? error.name : "ANALYSIS_FAILED";
}

function analysisContractError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const code = /movementScores|movement scores/i.test(message)
    ? "ANALYSIS_CONTRACT_MOVEMENT_SCORES"
    : /evidenceSelections|evidence selection|timestamp/i.test(message)
      ? "ANALYSIS_CONTRACT_EVIDENCE"
      : /generalGuidance|general guidance/i.test(message)
        ? "ANALYSIS_CONTRACT_GUIDANCE"
        : "ANALYSIS_CONTRACT_INVALID";
  return Object.assign(new Error(message), { code });
}

function databaseError(context: "ANALYSIS_STATE_SAVE_FAILED" | "ANALYSIS_RESULT_SAVE_FAILED", error: unknown): Error {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? context)
    : context;
  const providerCode = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "").toUpperCase().replace(/[^A-Z0-9_]/g, "_")
    : "";
  const constraint = /constraint\s+"([^"]+)"/i.exec(message)?.[1]
    ?.toUpperCase().replace(/[^A-Z0-9_]/g, "_") ?? "";
  const detail = constraint || providerCode;
  const code = (detail ? `${context}_${detail}` : context).slice(0, 64);
  console.error(JSON.stringify({ context, providerCode: providerCode || null, constraint: constraint || null, message }));
  return Object.assign(new Error(message), { code });
}

async function checksum(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

function stageRow(data: unknown): JsonRecord | null {
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object" && !Array.isArray(first) ? first as JsonRecord : null;
  }
  return data && typeof data === "object" && !Array.isArray(data) ? data as JsonRecord : null;
}

const EXERCISE_FAMILIES = new Set<ExerciseFamily>([
  "curl", "triceps", "press", "overhead-press", "fly", "raise", "row", "pull-down",
  "squat", "lunge", "hinge", "hip-thrust", "carry", "core", "plank", "other",
]);

function catalogFamily(value: unknown): ExerciseFamily | undefined {
  return typeof value === "string" && EXERCISE_FAMILIES.has(value as ExerciseFamily)
    ? value as ExerciseFamily
    : undefined;
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();

  async function recordModelCall(input: {
    sessionId: string;
    stage: ModelCallStage;
    modelName: string;
    requestedFps: number | null;
    clipStartMs?: number | null;
    clipEndMs?: number | null;
    startedAt: number;
    usage?: { promptTokens: number; outputTokens: number; thinkingTokens: number };
    status: "succeeded" | "failed";
    errorCode?: string;
  }): Promise<void> {
    await admin.from("model_call_telemetry").insert({
      session_id: input.sessionId,
      stage: input.stage,
      model: input.modelName,
      requested_fps: input.requestedFps,
      clip_start_ms: input.clipStartMs ?? null,
      clip_end_ms: input.clipEndMs ?? null,
      prompt_tokens: input.usage?.promptTokens ?? null,
      output_tokens: input.usage?.outputTokens ?? null,
      thinking_tokens: input.usage?.thinkingTokens ?? null,
      estimated_cost_usd: estimatedGeminiCost(input.modelName, input.usage),
      duration_ms: Math.max(0, Date.now() - input.startedAt),
      status: input.status,
      error_code: input.errorCode ?? null,
    }).then(() => undefined).catch(() => undefined);
  }

  async function generate(input: {
    sessionId: string;
    stage: ModelCallStage;
    modelName: string;
    request: Parameters<typeof generation.generate>[1];
    fps?: number | null;
    window?: { startMs: number; endMs: number } | null;
    timeoutMs: number;
  }): Promise<unknown> {
    const startedAt = Date.now();
    try {
      if (input.timeoutMs <= 0) throw Object.assign(new Error(`${input.stage} exceeded the analysis deadline`), { code: "ANALYSIS_DEADLINE_EXCEEDED" });
      const response = await generation.generate(input.modelName, input.request, { timeoutMs: input.timeoutMs });
      await recordModelCall({
        sessionId: input.sessionId,
        stage: input.stage,
        modelName: input.modelName,
        requestedFps: input.fps ?? null,
        clipStartMs: input.window?.startMs ?? null,
        clipEndMs: input.window?.endMs ?? null,
        startedAt,
        usage: response.usage,
        status: "succeeded",
      });
      return response.value;
    } catch (error) {
      await recordModelCall({
        sessionId: input.sessionId,
        stage: input.stage,
        modelName: input.modelName,
        requestedFps: input.fps ?? null,
        clipStartMs: input.window?.startMs ?? null,
        clipEndMs: input.window?.endMs ?? null,
        startedAt,
        status: "failed",
        errorCode: errorCode(error),
      });
      throw error;
    }
  }

  async function claimStage(sessionId: string, stage: StageName, input: unknown): Promise<StageClaim> {
    const { data, error } = await admin.rpc("claim_analysis_stage", {
      p_session_id: sessionId,
      p_pipeline_version: PIPELINE_VERSION,
      p_stage: stage,
      p_input_checksum: await checksum(input),
      p_lease_seconds: 150,
    });
    if (error) throw error;
    const row = stageRow(data);
    if (!row || typeof row.result_status !== "string" || typeof row.stage_run_id !== "string" || typeof row.lease_token !== "string") {
      throw Object.assign(new Error("Stage lease response was invalid"), { code: "ANALYSIS_STAGE_LEASE_INVALID" });
    }
    return { resultStatus: row.result_status, stageRunId: row.stage_run_id, leaseToken: row.lease_token, output: row.output ?? null };
  }

  async function finishStage(claim: StageClaim, output: unknown): Promise<void> {
    const { data, error } = await admin.rpc("complete_analysis_stage", {
      p_stage_run_id: claim.stageRunId,
      p_lease_token: claim.leaseToken,
      p_output: output,
    });
    if (error || data !== true) throw Object.assign(error ?? new Error("Stage lease was lost"), { code: "ANALYSIS_STAGE_LEASE_LOST" });
  }

  async function failStage(claim: StageClaim, code: string): Promise<void> {
    const result = await admin.from("analysis_stage_runs").update({
      status: "failed",
      error_code: code,
      lease_expires_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", claim.stageRunId).eq("lease_token", claim.leaseToken).select("id").maybeSingle();
    const persistenceError = stageFailurePersistenceError(result);
    if (persistenceError) throw persistenceError;
  }

  async function persistRetryState(sessionId: string, values: JsonRecord): Promise<void> {
    const { error } = await admin.from("analysis_sessions").update(values).eq("id", sessionId);
    if (error) throw databaseError("ANALYSIS_STATE_SAVE_FAILED", error);
  }

  async function runStage<T>(sessionId: string, stage: StageName, input: unknown, work: () => Promise<T>): Promise<T> {
    const claim = await claimStage(sessionId, stage, input);
    return runClaimedStage({ claim, work, complete: finishStage, fail: failStage, errorCode });
  }

  async function prepareGeminiVideo(session: WholeVideoSession): Promise<{ input: WholeVideoInput; byteLength: number | null; file: GeminiFile }> {
    const existingName = typeof session.geminiFileName === "string" ? session.geminiFileName : null;
    let byteLength: number | null = typeof session.analysis_input_byte_length === "number" && session.analysis_input_byte_length > 0
      ? session.analysis_input_byte_length
      : null;
    const uploadRetainedVideo = async (): Promise<GeminiFile> => {
      const path = selectGeminiVideoPath({
        videoPath: session.videoPath,
        analysisVideoPath: session.analysisVideoPath,
        analysisFallbackVideoPath: session.analysisFallbackVideoPath ?? null,
        analysisInputVariant: String(session.analysisInputVariant ?? "primary"),
        analysisInputStrategy: String(session.analysisInputStrategy ?? "video"),
      });
      const { data: video, error } = await admin.storage.from("analysis-videos").download(path);
      if (error) throw Object.assign(error, { code: "ANALYSIS_VIDEO_DOWNLOAD_FAILED" });
      if (!video || video.size <= 0) throw Object.assign(new Error("The analysis video is empty"), { code: "ANALYSIS_VIDEO_EMPTY" });
      byteLength = video.size;
      const mimeType = (video.type || "video/mp4").toLowerCase();
      if (!mimeType.includes("mp4")) throw Object.assign(new Error("The analysis video is not MP4"), { code: "ANALYSIS_VIDEO_INVALID_TYPE" });
      const uploaded = await files.uploadVideo({
        body: video,
        contentLength: video.size,
        mimeType: "video/mp4",
        displayName: `${session.id}.mp4`,
      });
      const { error: metadataError } = await admin.from("analysis_sessions").update({
        gemini_file_name: uploaded.name,
        gemini_file_uri: uploaded.uri,
        gemini_file_state: uploaded.state,
        updated_at: new Date().toISOString(),
      }).eq("id", session.id);
      if (metadataError) throw Object.assign(metadataError, { code: "ANALYSIS_FILE_METADATA_FAILED" });
      return uploaded;
    };
    let file = await reuseOrUploadGeminiFile({
      existingName,
      getFile: (name) => files.getFile(name),
      upload: uploadRetainedVideo,
    });

    if (file.state === "PROCESSING") {
      const { error: processingError } = await admin.from("analysis_sessions").update({
        status: "processing",
        stage: "video_processing",
        pipeline_version: PIPELINE_VERSION,
        updated_at: new Date().toISOString(),
      }).eq("id", session.id);
      if (processingError) throw Object.assign(processingError, { code: "ANALYSIS_FILE_METADATA_FAILED" });
      const readinessStartedAt = Date.now();
      let delayMs = 0;
      while (file.state === "PROCESSING" && Date.now() - readinessStartedAt < 60_000) {
        const remainingMs = 60_000 - (Date.now() - readinessStartedAt);
        if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, remainingMs)));
        if (Date.now() - readinessStartedAt >= 60_000) break;
        file = await files.getFile(file.name);
        delayMs = Math.min(delayMs === 0 ? 250 : delayMs * 2, 5_000);
      }
    }
    if (file.state === "FAILED") throw Object.assign(new Error(file.failureReason || "Gemini could not process the uploaded video"), { code: "GEMINI_FILE_FAILED", providerStatus: "FAILED" });
    if (file.state !== "ACTIVE") throw Object.assign(new Error("The uploaded video is still processing"), { code: "ANALYSIS_FILE_PROCESSING" });
    return { input: { uri: file.uri, mimeType: file.mimeType || "video/mp4" }, byteLength, file };
  }

  const response = await analyzeWholeVideoHandler(request, {
    authenticate: async (incoming) => {
      const retrySecret = Deno.env.get("ANALYSIS_RETRY_SECRET") ?? Deno.env.get("RETENTION_CLEANUP_SECRET");
      const retryUserId = incoming.headers.get("x-analysis-retry-user-id");
      if (
        retrySecret
        && incoming.headers.get("x-analysis-retry-secret") === retrySecret
        && retryUserId
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(retryUserId)
      ) {
        return retryUserId;
      }
      return requireUserId(incoming, admin);
    },
    loadSession: async (sessionId, userId) => {
      const [{ data: session, error }, { data: result, error: resultError }, { data: storedStage, error: storedStageError }] = await Promise.all([
        admin.from("analysis_sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle(),
        admin.from("analysis_results").select("*").eq("session_id", sessionId).maybeSingle(),
        admin.from("analysis_stage_runs").select("output,pipeline_version").eq("session_id", sessionId).eq("stage", "analyzing").eq("status", "succeeded").not("output", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (error) throw error;
      if (resultError) throw resultError;
      if (storedStageError) throw storedStageError;
      if (!session) return null;
      const declaration = session.set_declaration ? parseSetDeclaration(session.set_declaration) : null;
      let catalogExerciseFamily: ExerciseFamily | undefined;
      let catalogEquipment: string[] | undefined;
      if (typeof session.exercise_variant_v2_id === "number") {
        const { data: catalog, error: catalogError } = await admin
          .from("exercise_variants_v2")
          .select("family,mechanics")
          .eq("id", session.exercise_variant_v2_id)
          .maybeSingle();
        if (catalogError) throw catalogError;
        catalogExerciseFamily = catalogFamily(catalog?.family);
        const mechanics = catalog?.mechanics;
        const equipmentClass = mechanics && typeof mechanics === "object" && !Array.isArray(mechanics)
          ? (mechanics as Record<string, unknown>).equipmentClass
          : null;
        catalogEquipment = typeof equipmentClass === "string" && equipmentClass.trim()
          ? [equipmentClass.trim()]
          : [];
      }
      return {
        ...session,
        id: session.id,
        userId: session.user_id,
        failureCode: session.failure_code ?? null,
        analysisNextRetryAt: session.analysis_next_retry_at ?? null,
        videoPath: session.video_path,
        analysisVideoPath: session.analysis_video_path,
        analysisFallbackVideoPath: session.analysis_fallback_video_path ?? null,
        analysisInputVariant: session.analysis_input_variant ?? null,
        analysisInputStrategy: session.analysis_input_strategy ?? null,
        geminiFileName: session.gemini_file_name ?? null,
        geminiFileUri: session.gemini_file_uri ?? null,
        geminiFileState: session.gemini_file_state ?? null,
        durationMs: session.duration_ms,
        result: resultPayload(session, result),
        analysisDecision: session.analysis_draft && typeof session.analysis_draft === "object" ? session.analysis_draft : null,
        storedVideoStageOutput: storedStage?.output && typeof storedStage.output === "object" ? storedStage.output : null,
        hasStoredVideoEvidence: Boolean(session.analysis_draft || storedStage?.output),
        analysisRetryCount: Number(session.analysis_retry_count ?? 0),
        catalogExerciseFamily,
        catalogEquipment,
        setDeclaration: declaration,
      } as WholeVideoSession;
    },
    advancePipeline: async (rawSession) => {
      const invocationStartedAt = Date.now();
      const durationMs = rawSession.durationMs!;
      const declaration = rawSession.setDeclaration ? parseSetDeclaration(rawSession.setDeclaration) : undefined;
      const rawDecision = rawSession.analysisDecision && typeof rawSession.analysisDecision === "object" ? rawSession.analysisDecision as JsonRecord : null;
          // One full-video call establishes the evidence. The optional text-only
          // writer can improve copy, but it cannot rewatch or fail the analysis.
      let analysisVideo: WholeVideoInput | null = null;
      let geminiFileName: string | null = typeof rawSession.geminiFileName === "string" ? rawSession.geminiFileName : null;
      let geminiFile: GeminiFile | null = null;
      let byteLength: number | null = null;
      let inputPreparationMs: number | null = typeof rawSession.analysis_input_preparation_ms === "number"
        ? rawSession.analysis_input_preparation_ms
        : null;
      const parseTimestamp = (value: unknown): number | null => {
        if (typeof value !== "string") return null;
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const uploadStartedAt = parseTimestamp(rawSession.upload_started_at);
      const uploadCompletedAt = parseTimestamp(rawSession.upload_completed_at);
      const uploadDurationMs = uploadStartedAt !== null && uploadCompletedAt !== null
        ? Math.max(0, uploadCompletedAt - uploadStartedAt)
        : null;
      const analysisStartedAt = parseTimestamp(rawSession.analysis_started_at);
      const analysisRunStartedAt = analysisStartedAt ?? invocationStartedAt;
      // A queued session may sit untouched until the app opens it. Start the
          // budget on the first v46 invocation.
      const deadlineStartedAt = analysisDeadlineStartedAt({
        invocationStartedAt,
        persistedStartedAt: analysisStartedAt,
        pipelineVersion: typeof rawSession.pipeline_version === "string" ? rawSession.pipeline_version : null,
        stage: typeof rawSession.stage === "string" ? rawSession.stage : null,
      });
      const deadline = new AnalysisDeadline(deadlineStartedAt);
      const getGeminiVideo = async (): Promise<WholeVideoInput> => {
        if (!analysisVideo) {
          const preparationStartedAt = Date.now();
          const prepared = await prepareGeminiVideo(rawSession);
          analysisVideo = prepared.input;
          geminiFile = prepared.file;
          geminiFileName = prepared.file.name;
          byteLength = prepared.byteLength;
          inputPreparationMs = Math.max(0, Date.now() - preparationStartedAt);
          await admin.from("analysis_sessions").update({
            gemini_file_name: prepared.file.name,
            gemini_file_uri: prepared.file.uri,
            gemini_file_state: prepared.file.state,
            updated_at: new Date().toISOString(),
          }).eq("id", rawSession.id);
        }
        return analysisVideo;
      };
      const saveSessionStage = async (stage: string, extra: JsonRecord = {}) => {
        const { error } = await admin.from("analysis_sessions").update({
          status: "processing",
          stage,
          pipeline_version: PIPELINE_VERSION,
          analysis_started_at: new Date(analysisRunStartedAt).toISOString(),
          ...(byteLength !== null ? {
            analysis_input_transport: "file",
            analysis_input_byte_length: byteLength,
          } : {}),
          ...(inputPreparationMs !== null ? { analysis_input_preparation_ms: inputPreparationMs } : {}),
          ...(uploadDurationMs !== null ? { analysis_upload_duration_ms: uploadDurationMs } : {}),
          updated_at: new Date().toISOString(),
          ...extra,
        })
          .eq("id", rawSession.id)
          .not("status", "in", "(complete,partial,unable,failed)");
        if (error) throw databaseError("ANALYSIS_STATE_SAVE_FAILED", error);
      };

      return advanceWholeVideoPipeline({
        id: rawSession.id,
        durationMs,
        stage: typeof rawSession.stage === "string" ? rawSession.stage : null,
        analysisDecision: rawDecision,
        finalResult: rawSession.result,
      }, {
        analyzeWholeVideo: async ({ sessionId }) => {
          await saveSessionStage("analyzing");
          const storedVideoStageOutput = rawSession.storedVideoStageOutput && typeof rawSession.storedVideoStageOutput === "object"
            ? rawSession.storedVideoStageOutput as JsonRecord
            : null;
          const rawAnalysis = storedVideoStageOutput ?? await runStage(sessionId, "analyzing", { kind: "video", durationMs, transport: "file", fps: REQUESTED_ANALYSIS_FPS }, async () => {
            const analysisVideo = await getGeminiVideo();
            await saveSessionStage("analyzing");
            const requestBody = buildVideoGenerateContentRequest({
              video: analysisVideo,
                  prompt: buildBoundaryFreeAnalysisPrompt(durationMs, declaration),
                  schema: BOUNDARY_FREE_ANALYSIS_SCHEMA,
              fps: REQUESTED_ANALYSIS_FPS,
              thinkingLevel: ANALYST_THINKING_LEVEL,
              mediaResolution: REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
              temperature: 0,
            });
            const raw = await generate({ sessionId, stage: "analyzing", modelName: ANALYST_MODEL, request: requestBody, fps: REQUESTED_ANALYSIS_FPS, timeoutMs: deadline.timeoutFor("analyzing") }) as JsonRecord;
            return raw as JsonRecord;
          });
          // The successful provider response is durably attached to the stage
          // before local validation. A parser failure cannot trigger a rewatch.
          let parsedAnalysis: ReturnType<typeof parseBoundaryFreeAnalysis>;
          try {
            parsedAnalysis = parseBoundaryFreeAnalysis(rawAnalysis, durationMs);
          } catch (error) {
            throw analysisContractError(error);
          }
          await saveSessionStage("finalizing");
          const writing = parseWholeVideoWriting(null, parsedAnalysis);
          const decision = { analysis: parsedAnalysis, writing } as unknown as JsonRecord;
          await saveSessionStage("finalizing", { analysis_draft: decision });
          return decision;
        },
        saveAnalysis: async (sessionId, decision) => {
          await saveSessionStage("finalizing", {
            analysis_draft: decision,
          });
        },
        assembleResult: (decision) => {
              const combined = decision as { analysis: ReturnType<typeof parseBoundaryFreeAnalysis>; writing: ReturnType<typeof parseWholeVideoWriting> };
              return boundaryFreeToCandidate(
                combined.analysis,
                declaration,
                {
                  exerciseFamily: rawSession.catalogExerciseFamily as ExerciseFamily | undefined,
                  equipment: Array.isArray(rawSession.catalogEquipment) ? rawSession.catalogEquipment as string[] : undefined,
                },
                combined.writing,
              ) as unknown as JsonRecord;
        },
        saveResult: async (sessionId, rawResult) => {
          const candidate = rawResult as unknown as AnalysisCandidate;
          await runStage(sessionId, "finalizing", { status: candidate.status, itemCount: candidate.priorityCorrections.length + candidate.coachingCues.length }, async () => {
            const { error } = await admin.rpc("commit_analysis_result_v2", {
              p_session_id: sessionId,
              p_session: {
                pipeline_version: PIPELINE_VERSION,
                exercise_family: candidate.recognition.exerciseFamily,
                exercise_variant_v2_id: candidate.recognition.catalogExerciseId,
                detected_label: candidate.recognition.label,
                detected_variation: candidate.recognition.variation,
                detected_equipment: candidate.recognition.equipment,
                recognition_confidence: candidate.recognition.confidence,
                recognition_alternatives: candidate.recognition.alternatives,
                model_name: ANALYST_MODEL,
              },
              p_result: {
                status: candidate.status,
                analysis_basis: candidate.analysisBasis ?? "observed",
                view_notes: [],
                general_guidance: [],
                overall_assessment: candidate.overallAssessment,
                muscle_focus: candidate.muscleFocus,
                coach_note: candidate.coachNote,
                score: candidate.score,
                score_rationale: candidate.scoreRationale,
                movement_scores: candidate.movementScores ?? [],
                equipment_observations: candidate.equipmentObservations,
                exercise_guide: candidate.exerciseGuide ?? null,
                did_well: candidate.didWell,
                priority_corrections: candidate.priorityCorrections,
                coaching_cues: candidate.coachingCues,
                rep_timeline: candidate.repTimeline,
                set_context: candidate.setContext,
                set_summary: candidate.setSummary,
                next_set_plan: candidate.nextSetPlan,
                empty_correction_message: null,
                rubric_coverage: null,
                pipeline_version: PIPELINE_VERSION,
                comparison: candidate.comparison,
                analysis_version: PIPELINE_VERSION,
              },
            });
            if (error) throw databaseError("ANALYSIS_RESULT_SAVE_FAILED", error);
            const { count: modelCallCount, error: telemetryError } = await admin
              .from("model_call_telemetry")
              .select("id", { count: "exact", head: true })
              .eq("session_id", sessionId);
            if (telemetryError) throw databaseError("ANALYSIS_RESULT_SAVE_FAILED", telemetryError);
            const analysisTotalDurationMs = Math.max(0, Date.now() - analysisRunStartedAt);
              const { error: sessionError } = await admin.from("analysis_sessions").update({
                status: candidate.status,
                stage: "complete",
                analysis_total_duration_ms: analysisTotalDurationMs,
                analysis_model_call_count: modelCallCount ?? 0,
                analysis_correction_count: candidate.priorityCorrections.length,
                analysis_retry_count: 0,
                analysis_next_retry_at: null,
                analysis_last_error_code: null,
                updated_at: new Date().toISOString(),
            }).eq("id", sessionId);
            if (sessionError) throw databaseError("ANALYSIS_RESULT_SAVE_FAILED", sessionError);
            return { status: candidate.status };
          });
          if (geminiFileName || geminiFile) {
            await files.deleteFile(geminiFileName ?? geminiFile?.name ?? "").catch(() => undefined);
            await admin.from("analysis_sessions").update({
              gemini_file_name: null,
              gemini_file_uri: null,
              gemini_file_state: null,
              updated_at: new Date().toISOString(),
            }).eq("id", sessionId);
          }
        },
      });
    },
    persistFailure: async (sessionId, code, disposition) => {
      const { data: retryState, error: retryStateError } = await admin
        .from("analysis_sessions")
        .select("status,gemini_file_name,analysis_retry_count")
        .eq("id", sessionId)
        .maybeSingle();
      if (retryStateError) throw databaseError("ANALYSIS_STATE_SAVE_FAILED", retryStateError);
      const { data: existingResult, error: existingResultError } = await admin
        .from("analysis_results")
        .select("status")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (existingResultError) throw databaseError("ANALYSIS_RESULT_SAVE_FAILED", existingResultError);
      if (retryState?.status === "complete" || retryState?.status === "partial" || existingResult?.status === "complete" || existingResult?.status === "partial") {
        if (typeof retryState?.gemini_file_name === "string") {
          await files.deleteFile(retryState.gemini_file_name).catch(() => undefined);
        }
        await persistRetryState(sessionId, {
          status: existingResult?.status ?? retryState?.status ?? "complete",
          stage: "complete",
          failure_code: null,
          analysis_retry_count: 0,
          analysis_next_retry_at: null,
          analysis_last_error_code: null,
          gemini_file_name: null,
          gemini_file_uri: null,
          gemini_file_state: null,
          updated_at: new Date().toISOString(),
        });
        return { status: existingResult?.status ?? retryState?.status ?? "complete", stage: "complete" };
      }
      const nextRetryCount = Number(retryState?.analysis_retry_count ?? 0) + 1;
      const terminal = disposition.disposition === "terminal_failure" || nextRetryCount > MAX_DURABLE_RETRIES;
      if (terminal && typeof retryState?.gemini_file_name === "string") {
        await files.deleteFile(retryState.gemini_file_name).catch(() => undefined);
      }
      if (!terminal) {
        const backoffSeconds = Math.min(5 * 2 ** Math.max(0, nextRetryCount - 1), 60);
        await persistRetryState(sessionId, {
          status: "processing",
          stage: "retry_wait",
          pipeline_version: PIPELINE_VERSION,
          failure_code: null,
          analysis_retry_count: nextRetryCount,
          analysis_next_retry_at: new Date(Date.now() + backoffSeconds * 1_000).toISOString(),
          analysis_last_error_code: code,
          updated_at: new Date().toISOString(),
        });
        return { status: "processing", stage: "retry_wait" };
      }
      await persistRetryState(sessionId, {
        status: "failed",
        stage: "failed",
        pipeline_version: PIPELINE_VERSION,
        failure_code: code,
        analysis_next_retry_at: null,
        analysis_retry_count: nextRetryCount,
        analysis_last_error_code: code,
        gemini_file_name: null,
        gemini_file_uri: null,
        gemini_file_state: null,
        updated_at: new Date().toISOString(),
      });
      return { status: "failed", stage: "failed" };
    },
  });

  return withCors(response);
});
