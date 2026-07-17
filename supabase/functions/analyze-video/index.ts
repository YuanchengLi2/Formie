import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { type AnalysisCandidate } from "../_shared/analysis-contract.ts";
import { REQUESTED_ANALYSIS_FPS } from "../_shared/analysis-settings.ts";
import { buildAnalysisPrompt, type CompactExerciseProfile } from "../_shared/analysis-prompt.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { createGeminiVideoClient } from "../_shared/gemini-video.ts";
import { resultPayload } from "../_shared/result-payload.ts";
import { analyzeVideoHandler, type AnalyzeVideoSession } from "./handler.ts";

const gemini = createGeminiVideoClient({
  apiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
  model: Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash",
});

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

function compactProfile(row: Record<string, unknown>, profile: Record<string, unknown> | null): CompactExerciseProfile {
  const faults = Array.isArray(profile?.commonFaults) ? profile.commonFaults : [];
  return {
    id: Number(row.id),
    name: String(row.name),
    aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
    phases: Array.isArray(profile?.phases) ? profile.phases.map(String) : [],
    attentionAreas: Array.isArray(profile?.attentionAreas) ? profile.attentionAreas.map(String) : [],
    commonFaults: faults.map((fault) => {
      if (typeof fault === "string") return fault;
      if (fault && typeof fault === "object") {
        const value = fault as Record<string, unknown>;
        return [value.observation, value.whyItMatters, value.cue].filter(Boolean).join(" — ");
      }
      return String(fault);
    }),
  };
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();

  const response = await analyzeVideoHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    loadSession: async (sessionId, userId) => {
      const { data: session, error } = await admin.from("analysis_sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      if (!session) return null;
      const { data: result, error: resultError } = await admin.from("analysis_results").select("*").eq("session_id", sessionId).maybeSingle();
      if (resultError) throw resultError;
      return {
        id: session.id,
        userId: session.user_id,
        status: session.status,
        stage: session.stage,
        videoPath: session.video_path,
        durationMs: session.duration_ms,
        requestedFps: REQUESTED_ANALYSIS_FPS,
        geminiFileName: session.gemini_file_name,
        geminiFileUri: session.gemini_file_uri,
        geminiFileState: session.gemini_file_state,
        preflightCheck: session.preflight_check,
        analysisDraft: session.analysis_draft,
        result: resultPayload(session, result),
      } as AnalyzeVideoSession;
    },
    uploadFile: async (session) => {
      if (!session.videoPath) throw new Error("Video path is missing");
      const { data: video, error } = await admin.storage.from("analysis-videos").download(session.videoPath);
      if (error) throw error;
      return gemini.uploadVideo({
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
        stage: "video_check",
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
      if (error) throw error;
    },
    getFile: (name) => gemini.getFile(name),
    saveFileState: async (sessionId, file) => {
      const { error } = await admin.from("analysis_sessions").update({
        gemini_file_uri: file.uri,
        gemini_file_state: file.state,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
      if (error) throw error;
    },
    checkVideo: (_session, file) => gemini.checkVideo({ file }),
    savePreflightCheck: async (sessionId, check) => {
      const { error } = await admin.from("analysis_sessions").update({
        preflight_check: check,
        preflight_checked_at: new Date().toISOString(),
        stage: "video_processing",
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
      if (error) throw error;
    },
    buildPrompt: async (session) => {
      const [{ data: exercises, error: exerciseError }, { data: profileRows, error: profileError }] = await Promise.all([
        admin.from("exercises").select("id,name,aliases").eq("is_active", true).order("id"),
        admin.from("exercise_profiles").select("exercise_id,version,profile").eq("is_active", true).order("version", { ascending: false }),
      ]);
      if (exerciseError) throw exerciseError;
      if (profileError) throw profileError;
      const latestProfiles = new Map<number, Record<string, unknown>>();
      for (const row of profileRows ?? []) if (!latestProfiles.has(row.exercise_id)) latestProfiles.set(row.exercise_id, row.profile);
      const profiles = (exercises ?? []).map((row) => compactProfile(row, latestProfiles.get(row.id) ?? null));

      const { data: current } = await admin.from("analysis_sessions").select("previous_session_id").eq("id", session.id).single();
      let previousResult: AnalysisCandidate | null = null;
      if (current?.previous_session_id) {
        const [{ data: previousSession }, { data: previousRow }] = await Promise.all([
          admin.from("analysis_sessions").select("*").eq("id", current.previous_session_id).single(),
          admin.from("analysis_results").select("*").eq("session_id", current.previous_session_id).single(),
        ]);
        previousResult = resultPayload(previousSession, previousRow);
      }

      return buildAnalysisPrompt({
        profiles,
        previousResult,
      });
    },
    generate: (session, file, prompt) => gemini.generateAnalysis({ file, prompt, durationMs: session.durationMs ?? 0 }),
    saveDraft: async (sessionId, draft) => {
      const { error } = await admin.from("analysis_sessions").update({
        analysis_draft: draft,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
      if (error) throw error;
    },
    verify: (session, file, draft) => gemini.verifyAnalysis({ file, draft, durationMs: session.durationMs ?? 0 }),
    markStage: async (sessionId, stage) => {
      const { error } = await admin.from("analysis_sessions").update({ status: "processing", stage, updated_at: new Date().toISOString() }).eq("id", sessionId);
      if (error) throw error;
    },
    saveResult: async (sessionId, result) => {
      const recognition = result.recognition;
      let exerciseId = recognition.catalogExerciseId;
      if (exerciseId !== null) {
        const { data } = await admin.from("exercises").select("id").eq("id", exerciseId).maybeSingle();
        if (!data) exerciseId = null;
      }
      const now = new Date().toISOString();
      const { error: sessionError } = await admin.from("analysis_sessions").update({
        status: result.status,
        stage: result.status === "unable" ? "video_check" : "coaching",
        exercise_family: recognition.exerciseFamily,
        detected_label: recognition.label,
        detected_variation: recognition.variation,
        detected_equipment: recognition.equipment,
        recognition_confidence: recognition.confidence,
        recognition_alternatives: recognition.alternatives,
        exercise_id: exerciseId,
        model_name: Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash",
        completed_at: now,
        updated_at: now,
      }).eq("id", sessionId);
      if (sessionError) throw sessionError;
      const { error: resultError } = await admin.from("analysis_results").upsert({
        session_id: sessionId,
        status: result.status,
        video_check: result.videoCheck,
        overall_assessment: result.overallAssessment,
        score: result.score,
        score_rationale: result.scoreRationale,
        did_well: result.didWell,
        priority_corrections: result.priorityCorrections,
        coaching_cues: result.coachingCues,
        set_context: result.setContext,
        set_summary: result.setSummary,
        rep_timeline: result.repTimeline,
        next_set_plan: result.nextSetPlan,
        precision_review: result.precisionReview ?? null,
        premium_runs_used: result.precisionReview?.runsUsed ?? 0,
        verification: result.verification ?? null,
        comparison: result.comparison,
        analysis_version: "gemini-video-4.1.0",
      }, { onConflict: "session_id" });
      if (resultError) throw resultError;
    },
    clearDraft: async (sessionId) => {
      const { error } = await admin.from("analysis_sessions").update({ analysis_draft: null, updated_at: new Date().toISOString() }).eq("id", sessionId);
      if (error) throw error;
    },
    markFailed: async (sessionId, code) => {
      const { error } = await admin.from("analysis_sessions").update({ status: "failed", failure_code: code, updated_at: new Date().toISOString() }).eq("id", sessionId);
      if (error) throw error;
    },
    deleteFile: (name) => gemini.deleteFile(name),
  });

  return withCors(response);
});
