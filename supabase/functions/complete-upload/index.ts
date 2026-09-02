import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { requireCurrentAiEligibility } from "../_shared/ai-eligibility.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { completeUploadHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "user", maxBodyBytes: 4_096 });
  if (security) return security;
  const admin = createAdminClient();
  const response = await completeUploadHandler(request, {
    authenticate: async (incoming) => {
      const userId = await requireUserId(incoming, admin);
      await requireCurrentAiEligibility(admin, userId);
      return userId;
    },
    findSession: async (sessionId, userId) => {
      const { data, error } = await admin.from("analysis_sessions").select("id,video_path").eq("id", sessionId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, videoPath: data.video_path } : null;
    },
    videoExists: async (path) => {
      const { data, error } = await admin.storage.from("analysis-videos").exists(path);
      if (error) throw error;
      return data;
    },
    wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    markProcessing: async (input) => {
      const { error } = await admin.from("analysis_sessions").update({
        status: "processing",
        stage: "video_check",
        video_path: input.videoPath,
        duration_ms: input.durationMs,
        analysis_input_strategy: input.analysisInputStrategy,
        analysis_video_path: input.analysisVideoPath ?? null,
        analysis_fallback_video_path: input.analysisFallbackVideoPath ?? null,
        analysis_input_variant: "primary",
        analysis_duration_ms: input.analysisDurationMs ?? null,
        analysis_source_start_ms: input.sourceStartMs ?? null,
        analysis_source_end_ms: input.sourceEndMs ?? null,
        analysis_crop: input.crop ?? null,
        analysis_preprocessing_confidence: input.preprocessingConfidence ?? null,
        failure_code: null,
        upload_completed_at: new Date().toISOString(),
        analysis_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", input.sessionId).eq("user_id", input.userId);
      if (error) throw error;
    },
  });

  return withCors(request, response);
});
