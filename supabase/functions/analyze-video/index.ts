import type { AnalysisCandidate } from "../_shared/analysis-contract.ts";
import { REQUESTED_ANALYSIS_FPS, REQUESTED_ANALYSIS_MEDIA_RESOLUTION } from "../_shared/analysis-settings.ts";
import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import {
  buildTextGenerateContentRequest,
  buildVideoGenerateContentRequest,
  createGenerateContentClient,
} from "../_shared/gemini-generate.ts";
import { createGeminiFilesClient } from "../_shared/gemini-files.ts";
import { resultPayload } from "../_shared/result-payload.ts";
import { parseSetDeclaration, type SetDeclaration } from "../_shared/set-declaration.ts";
import { selectGeminiVideoPath } from "./analysis-input.ts";
import {
  buildMovementLocalizationPrompt,
  MOVEMENT_LOCALIZATION_SCHEMA,
  movementLocalizationAnchor,
  parseMovementLocalization,
} from "./movement-localization.ts";
import {
  ANALYSIS_DECISION_SCHEMA,
  COMBINED_ANALYSIS_SCHEMA,
  analysisValidationFailureCode,
  buildSinglePassAnalysisPrompt,
  buildTargetedContradictionReviewPrompt,
  buildWriterAuditPrompt,
  detectRawFactualContradictions,
  type FactualContradiction,
  mergeWriterCopy,
  parseAnalysisDecision,
  parseCombinedAnalysisResponse,
  parseWriterAuditResponse,
  parseWriterCopyPatch,
  targetedReviewWindows,
  writerAuditSchema,
} from "../_shared/single-pass-analysis.ts";
import { analyzeVideoHandler, type AnalyzeVideoSession } from "./handler.ts";
import { advanceSinglePassPipeline } from "./single-pass-runner.ts";

const PIPELINE_VERSION = "gemini-analyst-coach-v36";
const ANALYST_MODEL = "gemini-3.6-flash";
const WRITER_MODEL = "gemini-3.1-flash-lite";
const REPAIR_MODEL = "gemini-3.6-flash";
const MAX_WRITER_REPAIR_ATTEMPTS = 2;
const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
const files = createGeminiFilesClient({ apiKey });
const generation = createGenerateContentClient({ apiKey });

  type JsonRecord = Record<string, unknown>;

  function parseDecision(value: unknown, durationMs: number, sessionId: string, declaration?: SetDeclaration) {
    try {
      return parseAnalysisDecision(value, durationMs, declaration);
    } catch (error) {
      const validationError = error instanceof Error ? error : new Error(String(error));
      const code = analysisValidationFailureCode(error);
      const response = value && typeof value === "object" && !Array.isArray(value)
        ? value as JsonRecord
        : null;
      console.error(JSON.stringify({
        event: "analysis_validation_failed",
        sessionId,
        code,
        validationIssue: validationError.message.slice(0, 500),
        responseShape: response
          ? {
            keys: Object.keys(response),
            status: response.status ?? null,
            findingCount: Array.isArray(response.findings) ? response.findings.length : null,
            correctionCount: Array.isArray(response.corrections) ? response.corrections.length : null,
          }
          : { type: Array.isArray(value) ? "array" : typeof value },
      }));
      throw Object.assign(validationError, { code });
    }
  }

  function parseCombined(value: unknown, durationMs: number, sessionId: string, declaration?: SetDeclaration) {
    try {
      return parseCombinedAnalysisResponse(value, durationMs, declaration);
    } catch (error) {
      const code = analysisValidationFailureCode(error);
      console.error(JSON.stringify({
        event: "combined_analysis_validation_failed",
        sessionId,
        code,
      }));
      throw Object.assign(error instanceof Error ? error : new Error("Combined analysis response validation failed"), { code });
    }
  }

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();

  async function recordModelCall(input: {
    sessionId: string;
    stage: string;
    modelName: string;
    requestedFps: number | null;
    clipStartMs?: number | null;
    clipEndMs?: number | null;
    startedAt: number;
    usage?: { promptTokens: number; outputTokens: number; thinkingTokens: number };
    status: "succeeded" | "failed";
    errorCode?: string;
  }) {
    const { error } = await admin.from("model_call_telemetry").insert({
      session_id: input.sessionId,
      stage: input.stage,
      model: input.modelName,
      requested_fps: input.requestedFps,
      clip_start_ms: input.clipStartMs ?? null,
      clip_end_ms: input.clipEndMs ?? null,
      prompt_tokens: input.usage?.promptTokens ?? null,
      output_tokens: input.usage?.outputTokens ?? null,
      thinking_tokens: input.usage?.thinkingTokens ?? null,
      duration_ms: Math.max(0, Date.now() - input.startedAt),
      status: input.status,
      error_code: input.errorCode ?? null,
    });
    if (error) throw error;
  }

  async function generate(input: {
    sessionId: string;
    stage: string;
    modelName: string;
    request: Parameters<typeof generation.generate>[1];
    fps?: number | null;
    windows?: Array<{ startMs: number; endMs: number }>;
  }) {
    const startedAt = Date.now();
    try {
      const response = await generation.generate(input.modelName, input.request);
      await recordModelCall({
        sessionId: input.sessionId,
        stage: input.stage,
        modelName: input.modelName,
        requestedFps: input.fps ?? null,
        clipStartMs: input.windows?.length ? Math.min(...input.windows.map((window) => window.startMs)) : null,
        clipEndMs: input.windows?.length ? Math.max(...input.windows.map((window) => window.endMs)) : null,
        startedAt,
        usage: response.usage,
        status: "succeeded",
      }).catch(() => undefined);
      return response.value;
    } catch (error) {
      await recordModelCall({
        sessionId: input.sessionId,
        stage: input.stage,
        modelName: input.modelName,
        requestedFps: input.fps ?? null,
        clipStartMs: input.windows?.length ? Math.min(...input.windows.map((window) => window.startMs)) : null,
        clipEndMs: input.windows?.length ? Math.max(...input.windows.map((window) => window.endMs)) : null,
        startedAt,
        status: "failed",
        errorCode: error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "MODEL_CALL_FAILED")
          : error instanceof Error ? error.name : "MODEL_CALL_FAILED",
      }).catch(() => undefined);
      throw error;
    }
  }

  const response = await analyzeVideoHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    loadSession: async (sessionId, userId) => {
      const [{ data: session, error }, { data: result, error: resultError }] = await Promise.all([
        admin.from("analysis_sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle(),
        admin.from("analysis_results").select("*").eq("session_id", sessionId).maybeSingle(),
      ]);
      if (error) throw error;
      if (resultError) throw resultError;
      if (!session) return null;
      const currentDeclaration = session.set_declaration ? parseSetDeclaration(session.set_declaration) : null;
      const currentPipeline = session.pipeline_version === PIPELINE_VERSION;
      return {
        id: session.id,
        userId: session.user_id,
        status: session.status,
        stage: session.stage,
        failureCode: session.failure_code ?? null,
        videoPath: session.video_path,
        analysisVideoPath: session.analysis_video_path,
        analysisFallbackVideoPath: session.analysis_fallback_video_path,
        analysisInputVariant: session.analysis_input_variant ?? "primary",
        analysisInputStrategy: session.analysis_input_strategy,
        durationMs: session.duration_ms,
        geminiFileName: session.gemini_file_name,
        geminiFileUri: session.gemini_file_uri,
        geminiFileState: session.gemini_file_state,
        analysisDecision: currentPipeline && session.analysis_draft && typeof session.analysis_draft === "object"
          ? session.analysis_draft
          : null,
        writerCopy: currentPipeline && session.writer_result_v2 && typeof session.writer_result_v2 === "object"
          ? session.writer_result_v2
          : null,
        contradictions: currentPipeline && Array.isArray(session.analysis_contradictions)
          ? session.analysis_contradictions
          : [],
        setDeclaration: currentDeclaration,
        result: resultPayload(session, result),
      } as AnalyzeVideoSession;
    },
    uploadFile: async (session) => {
      const inputPath = selectGeminiVideoPath(session);
      const { data: video, error } = await admin.storage.from("analysis-videos").download(inputPath);
      if (error) throw error;
      return files.uploadVideo({
        body: video,
        contentLength: video.size,
        mimeType: video.type || "video/mp4",
        displayName: `${session.id}.mp4`,
      });
    },
    saveFile: async (sessionId, file) => {
      const { error } = await admin.from("analysis_sessions").update({
        gemini_file_name: file.name,
        gemini_file_uri: file.uri,
        gemini_file_state: file.state,
        pipeline_version: PIPELINE_VERSION,
        stage: "video_processing",
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
      if (error) throw error;
    },
    getFile: (name) => files.getFile(name),
    saveFileState: async (sessionId, file) => {
      const { error } = await admin.from("analysis_sessions").update({
        gemini_file_uri: file.uri,
        gemini_file_state: file.state,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
      if (error) throw error;
    },
    advancePipeline: async (rawSession, file) => {
      const durationMs = rawSession.durationMs!;
      const rawDecision = rawSession.analysisDecision && typeof rawSession.analysisDecision === "object"
        ? rawSession.analysisDecision as JsonRecord
        : null;
      const rawWriterCopy = rawSession.writerCopy && typeof rawSession.writerCopy === "object"
        ? rawSession.writerCopy as JsonRecord
        : null;
      const rawContradictions = Array.isArray(rawSession.contradictions)
        ? rawSession.contradictions as FactualContradiction[]
        : [];
      const declaration = rawSession.setDeclaration
        ? parseSetDeclaration(rawSession.setDeclaration)
        : undefined;
      const stage = rawDecision ? (rawWriterCopy ? "coaching" : "checking_consistency") : "analyzing";
      rawSession.stage = stage;
      const { error: stageError } = await admin.from("analysis_sessions").update({
        status: "processing",
        stage,
        pipeline_version: PIPELINE_VERSION,
        updated_at: new Date().toISOString(),
      }).eq("id", rawSession.id);
      if (stageError) throw stageError;

      return advanceSinglePassPipeline({
        id: rawSession.id,
        durationMs,
          file: { uri: file.uri, mimeType: file.mimeType },
          analysisDecision: rawDecision,
        writerCopy: rawWriterCopy,
        contradictions: rawContradictions,
        finalResult: rawSession.result,
      }, {
        localizeMovement: async (input) => {
          const requestBody = buildVideoGenerateContentRequest({
            file: input.file,
            prompt: buildMovementLocalizationPrompt(
              durationMs,
              declaration?.exercise.label ?? "the declared exercise",
              declaration?.amount.kind === "reps" ? declaration.amount.value : null,
            ),
            schema: MOVEMENT_LOCALIZATION_SCHEMA,
            fps: REQUESTED_ANALYSIS_FPS,
            thinkingLevel: "medium",
            mediaResolution: REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
          });
          const value = await generate({
            sessionId: input.sessionId,
            stage: "locating_movement",
            modelName: ANALYST_MODEL,
            request: requestBody,
            fps: REQUESTED_ANALYSIS_FPS,
          });
          return parseMovementLocalization(value, durationMs) as unknown as JsonRecord;
        },
        analyze: async (input) => {
          const localization = parseMovementLocalization(input.movementLocalization, durationMs);
          const analysisPrompt = `${buildSinglePassAnalysisPrompt(durationMs, declaration)}

DEDICATED TEMPORAL MOVEMENT PASS
${movementLocalizationAnchor(localization)}
Use these independently located movement windows to inspect the actual pixels. They locate the exercise only; independently determine technique, findings, and coaching evidence.`;
          const requestBody = buildVideoGenerateContentRequest({
            file: input.file,
            prompt: analysisPrompt,
            schema: ANALYSIS_DECISION_SCHEMA,
            fps: REQUESTED_ANALYSIS_FPS,
            thinkingLevel: "medium",
            mediaResolution: REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
          });
          const firstResponse = await generate({
            sessionId: input.sessionId,
            stage: "analyzing",
            modelName: ANALYST_MODEL,
            request: requestBody,
            fps: REQUESTED_ANALYSIS_FPS,
          });
          try {
            if (
              localization.outcome === "movement_found"
              && firstResponse
              && typeof firstResponse === "object"
              && !Array.isArray(firstResponse)
              && String((firstResponse as JsonRecord).status) === "unable"
            ) {
              throw Object.assign(new Error("The analyst returned unable despite independently localized exercise movement"), {
                code: "ANALYSIS_MOVEMENT_CONTRADICTION",
              });
            }
            const contradictions = detectRawFactualContradictions(firstResponse, durationMs);
            const parsed = parseDecision(firstResponse, durationMs, input.sessionId, declaration);
            return {
              decision: parsed as unknown as JsonRecord,
              contradictions,
            };
          } catch (firstValidationError) {
            const repairRequest = buildVideoGenerateContentRequest({
              file: input.file,
              prompt: `${analysisPrompt}

Rewatch the complete original video and independently redo the evidence audit needed to fix the validation problem below. Preserve supported observations, findings, scores, repetition facts, and timestamps, but do not preserve an invalid status or unsupported finding. Every correction must be independently supported by the pixels. Return only the complete analysis object.
Validation issue: ${firstValidationError instanceof Error ? firstValidationError.message : String(firstValidationError)}
Rejected analysis:
${JSON.stringify(firstResponse)}`,
              schema: ANALYSIS_DECISION_SCHEMA,
              fps: REQUESTED_ANALYSIS_FPS,
              thinkingLevel: "medium",
              mediaResolution: REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
            });
            try {
              const repairedValue = await generate({
                sessionId: input.sessionId,
                stage: "repairing_analysis",
                modelName: REPAIR_MODEL,
                request: repairRequest,
                fps: REQUESTED_ANALYSIS_FPS,
              });
              const repaired = parseDecision(repairedValue, durationMs, input.sessionId, declaration);
              return {
                decision: repaired as unknown as JsonRecord,
                contradictions: detectRawFactualContradictions(repairedValue, durationMs),
              };
            } catch (repairValidationError) {
              const validationMessage = repairValidationError instanceof Error
                ? repairValidationError.message
                : String(repairValidationError);
              throw Object.assign(new Error(`Combined analysis response validation failed: ${validationMessage}`), {
                code: analysisValidationFailureCode(repairValidationError),
              });
            }
          }
        },
        confirmUnable: async (input) => {
          const localization = parseMovementLocalization(input.movementLocalization, durationMs);
          const confirmationRequest = buildVideoGenerateContentRequest({
            file: input.file,
            prompt: `${buildSinglePassAnalysisPrompt(durationMs, declaration)}

INDEPENDENT UNABLE CONFIRMATION
Another pass classified this recording as unable. Treat that verdict as untrusted and independently rewatch the complete original video. Search specifically for repeated body, joint, or hand-held weight displacement between the setup and finish. If real repetitions are visible, analyze them instead of repeating a false no-movement verdict. Return unable for no movement only when the full-video rewatch independently confirms that no meaningful exercise movement can be analyzed.

DEDICATED TEMPORAL MOVEMENT PASS
${movementLocalizationAnchor(localization)}`,
            schema: ANALYSIS_DECISION_SCHEMA,
            fps: REQUESTED_ANALYSIS_FPS,
            thinkingLevel: "medium",
            mediaResolution: REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
          });
          const confirmedValue = await generate({
            sessionId: input.sessionId,
            stage: "confirming_unable",
            modelName: ANALYST_MODEL,
            request: confirmationRequest,
            fps: REQUESTED_ANALYSIS_FPS,
          });
          const confirmed = parseDecision(confirmedValue, durationMs, input.sessionId, declaration);
          return {
            decision: confirmed as unknown as JsonRecord,
            contradictions: detectRawFactualContradictions(confirmedValue, durationMs),
          };
        },
        writeAndAudit: async (input) => {
          const immutableDecision = parseDecision(input.decision, durationMs, input.sessionId, declaration);
          const prompt = buildWriterAuditPrompt(immutableDecision);
          const requestBody = buildTextGenerateContentRequest({
            prompt,
            schema: writerAuditSchema(immutableDecision),
            thinkingLevel: "low",
          });
          const firstResponse = await generate({
            sessionId: input.sessionId,
            stage: "checking_consistency",
            modelName: WRITER_MODEL,
            request: requestBody,
          });
          let currentResponse = firstResponse;
          let latestValidationError: unknown = null;
          for (let attempt = 0; attempt <= MAX_WRITER_REPAIR_ATTEMPTS; attempt += 1) {
            try {
              const parsed = parseWriterAuditResponse(currentResponse, immutableDecision, durationMs);
              return {
                writerCopy: parsed.coaching as unknown as JsonRecord,
                contradictions: parsed.contradictions,
              };
            } catch (validationError) {
              latestValidationError = validationError;
              if (attempt === MAX_WRITER_REPAIR_ATTEMPTS) break;
            }
            const repairRequest = buildTextGenerateContentRequest({
              prompt: `${prompt}

The previous writer-audit JSON was rejected. Fix only the validation issue and return the complete coaching and contradictions object. Do not change analyst-owned facts.
Validation issue: ${latestValidationError instanceof Error ? latestValidationError.message : String(latestValidationError)}
Rejected writer audit:
${JSON.stringify(currentResponse)}`,
              schema: writerAuditSchema(immutableDecision),
              thinkingLevel: "low",
            });
            currentResponse = await generate({
              sessionId: input.sessionId,
              stage: "repairing_coaching",
              modelName: WRITER_MODEL,
              request: repairRequest,
            });
          }
          throw Object.assign(new Error("Coaching consistency response validation failed"), {
            code: analysisValidationFailureCode(latestValidationError),
          });
        },
        reviewContradictions: async (input) => {
          const immutableDecision = parseDecision(input.decision, durationMs, input.sessionId, declaration);
          const immutableCopy = input.writerCopy ? parseWriterCopyPatch(input.writerCopy, immutableDecision) : null;
          const windows = targetedReviewWindows(immutableDecision, input.contradictions, durationMs);
          const reviewRequest = buildVideoGenerateContentRequest({
            file: input.file,
            prompt: buildTargetedContradictionReviewPrompt(immutableDecision, immutableCopy, input.contradictions),
            schema: COMBINED_ANALYSIS_SCHEMA,
            fps: REQUESTED_ANALYSIS_FPS,
            thinkingLevel: "medium",
            mediaResolution: REQUESTED_ANALYSIS_MEDIA_RESOLUTION,
            windows,
          });
          const reviewedValue = await generate({
            sessionId: input.sessionId,
            stage: "double_checking",
            modelName: ANALYST_MODEL,
            request: reviewRequest,
            fps: REQUESTED_ANALYSIS_FPS,
            windows,
          });
          const rawReviewed = reviewedValue && typeof reviewedValue === "object" && !Array.isArray(reviewedValue)
            ? reviewedValue as JsonRecord
            : {};
          const remaining = detectRawFactualContradictions(rawReviewed.analysis, durationMs);
          if (remaining.length > 0) {
            throw Object.assign(new Error("Targeted video review did not resolve the factual contradiction"), {
              code: "ANALYSIS_CONTRADICTION_UNRESOLVED",
            });
          }
          const reviewed = parseCombined(reviewedValue, durationMs, input.sessionId, declaration);
          return {
            decision: reviewed.decision as unknown as JsonRecord,
            writerCopy: reviewed.writerCopy as unknown as JsonRecord | null,
          };
        },
        setStage: async (sessionId, stage) => {
          rawSession.stage = stage;
          const { error } = await admin.from("analysis_sessions").update({
            status: "processing",
            stage,
            pipeline_version: PIPELINE_VERSION,
            updated_at: new Date().toISOString(),
          }).eq("id", sessionId);
          if (error) throw error;
        },
        saveAnalysis: async (sessionId, decision, copy, contradictions) => {
          const immutableDecision = parseDecision(decision, durationMs, sessionId, declaration);
          const immutableCopy = copy ? parseWriterCopyPatch(copy, immutableDecision) : null;
          rawSession.stage = immutableCopy ? "writing_coaching" : "checking_consistency";
          const { error } = await admin.from("analysis_sessions").update({
            analysis_draft: immutableDecision,
            correction_audit_v1: null,
            writer_result_v2: immutableCopy,
            analysis_contradictions: contradictions,
            status: "processing",
            stage: rawSession.stage,
            pipeline_version: PIPELINE_VERSION,
            updated_at: new Date().toISOString(),
          }).eq("id", sessionId);
          if (error) throw error;
        },
        assembleResult: (decision, copy) => {
          const immutableDecision = parseDecision(decision, durationMs, rawSession.id, declaration);
          const immutableCopy = copy ? parseWriterCopyPatch(copy, immutableDecision) : null;
          return {
            ...mergeWriterCopy(immutableDecision, immutableCopy),
            setDeclaration: declaration ?? null,
          } as unknown as JsonRecord;
        },
        saveResult: async (sessionId, rawResult) => {
          const result = rawResult as unknown as AnalysisCandidate;
          const { error } = await admin.rpc("commit_analysis_result_v2", {
            p_session_id: sessionId,
            p_session: {
              pipeline_version: PIPELINE_VERSION,
              exercise_family: result.recognition.exerciseFamily,
              exercise_variant_v2_id: result.recognition.catalogExerciseId,
              detected_label: result.recognition.label,
              detected_variation: result.recognition.variation,
              detected_equipment: result.recognition.equipment,
              recognition_confidence: result.recognition.confidence,
              recognition_alternatives: result.recognition.alternatives,
              model_name: ANALYST_MODEL,
            },
            p_result: {
              status: result.status,
              video_check: result.videoCheck,
              overall_assessment: result.overallAssessment,
            muscle_focus: result.muscleFocus,
            coach_note: result.coachNote,
            score: result.score,
            score_rationale: result.scoreRationale,
            movement_scores: result.movementScores ?? [],
            equipment_observations: result.equipmentObservations,
            exercise_guide: result.exerciseGuide ?? null,
            coaching_coverage: result.coachingCoverage ?? [],
            did_well: result.didWell,
            priority_corrections: result.priorityCorrections,
            coaching_cues: result.coachingCues,
            set_context: result.setContext,
            set_summary: result.setSummary,
            rep_timeline: result.repTimeline,
            next_set_plan: result.nextSetPlan,
            empty_correction_message: null,
            rubric_coverage: null,
              pipeline_version: PIPELINE_VERSION,
              comparison: result.comparison,
              analysis_version: PIPELINE_VERSION,
            },
          });
          if (error) throw error;
        },
      });
    },
    recordStageFailure: async (sessionId, stage, code) => {
      const { data, error } = await admin.rpc("record_analysis_stage_failure", {
        p_session_id: sessionId,
        p_stage: stage,
        p_error_code: code,
        p_max_attempts: 3,
      });
      if (error) throw error;
      const result = data as JsonRecord | null;
      return {
        attempts: Number(result?.attempts ?? 3),
        terminal: result?.terminal !== false,
      };
    },
    markFailed: async (sessionId, code) => {
      const { error } = await admin.from("analysis_sessions").update({
        status: "failed",
        failure_code: code,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
      if (error) throw error;
    },
    deleteFile: (name) => files.deleteFile(name),
    releaseStoredVideo: async (session, phase) => {
      const preserveFallback = phase === "source_uploaded" && session.analysisInputVariant === "primary";
      const releasedVideoState = {
        video_path: null,
        analysis_video_path: null,
        ...(preserveFallback ? {} : { analysis_fallback_video_path: null }),
        analysis_input_strategy: "video",
        analysis_duration_ms: null,
        analysis_source_start_ms: null,
        analysis_source_end_ms: null,
        analysis_crop: null,
        analysis_preprocessing_confidence: null,
        analysis_input_variant: "primary",
        updated_at: new Date().toISOString(),
      };
      const paths = [
        session.videoPath,
        session.analysisVideoPath,
        ...(preserveFallback ? [] : [session.analysisFallbackVideoPath]),
      ].filter((path): path is string => Boolean(path));
      if (paths.length > 0) {
        const { error } = await admin.storage.from("analysis-videos").remove([...new Set(paths)]);
        if (error) throw error;
      }
      const { error } = await admin.from("analysis_sessions")
        .update(releasedVideoState)
        .eq("id", session.id);
      if (error) throw error;
    },
    activateFallbackInput: async (sessionId) => {
      const { data, error } = await admin.from("analysis_sessions").update({
        analysis_input_variant: "privacy_safe_upper_body",
        gemini_file_name: null,
        gemini_file_uri: null,
        gemini_file_state: null,
        status: "processing",
        stage: "video_processing",
        failure_code: null,
        stage_attempts_v3: {},
        updated_at: new Date().toISOString(),
      })
        .eq("id", sessionId)
        .eq("analysis_input_variant", "primary")
        .not("analysis_fallback_video_path", "is", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (data) return true;
      const { data: current, error: currentError } = await admin.from("analysis_sessions")
        .select("analysis_input_variant,analysis_fallback_video_path")
        .eq("id", sessionId)
        .maybeSingle();
      if (currentError) throw currentError;
      return current?.analysis_input_variant === "privacy_safe_upper_body"
        && Boolean(current.analysis_fallback_video_path);
    },
  });

  return withCors(response);
});
