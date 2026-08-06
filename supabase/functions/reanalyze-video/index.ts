import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { createGeminiFilesClient } from "../_shared/gemini-files.ts";
import { reanalyzeVideoHandler, type ReanalysisResetOutcome } from "./handler.ts";
import { verifyRetainedAnalysisInput } from "./reusable-input.ts";

const files = createGeminiFilesClient({
  apiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
});

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();

  const response = await reanalyzeVideoHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    verifyReusableInput: async (sessionId, userId) => {
      const { data, error } = await admin
        .from("analysis_sessions")
        .select("video_path,analysis_video_path,gemini_file_name,duration_ms")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return "not_found";
      return verifyRetainedAnalysisInput(
        { videoPath: data.video_path, analysisVideoPath: data.analysis_video_path, geminiFileName: data.gemini_file_name, durationMs: data.duration_ms },
        {
          videoExists: async (path) => {
            const { data: exists, error: storageError } = await admin.storage.from("analysis-videos").exists(path);
            if (storageError) throw storageError;
            return exists;
          },
          getGeminiFileState: async (name) => (await files.getFile(name)).state,
        },
      );
    },
    canonicalizeDeclaration: async (declaration) => {
      if (declaration.exercise.source === "custom") return declaration;
      const { data, error } = await admin
        .from("exercise_variants_v2")
        .select("id,name")
        .eq("id", declaration.exercise.catalogExerciseId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("INVALID_EXERCISE");
      return {
        ...declaration,
        exercise: { source: "catalog", catalogExerciseId: data.id, label: data.name },
      };
    },
    reserveCredit: async ({ userId, sessionId, clientRequestId }) => {
      const { data, error } = await admin.rpc("reserve_analysis_credit_for_user", {
        p_user_id: userId,
        p_client_request_id: clientRequestId,
        p_kind: "reanalysis",
        p_session_id: sessionId,
      });
      if (error) {
        const code = error.message.match(/ANALYSIS_[A-Z_]+/)?.[0] ?? "ANALYSIS_ACCESS_FAILED";
        throw Object.assign(new Error(error.message), { code });
      }
      const row = (Array.isArray(data) ? data[0] : data) as { reservation_id?: unknown; remaining?: unknown; period_ends_at?: unknown } | null;
      if (!row || typeof row.reservation_id !== "string") throw Object.assign(new Error("Analysis access reservation was invalid"), { code: "ANALYSIS_ACCESS_FAILED" });
      return { reservationId: row.reservation_id, remaining: typeof row.remaining === "number" ? row.remaining : null, periodEndsAt: typeof row.period_ends_at === "string" ? row.period_ends_at : null };
    },
    cancelCredit: async (userId, reservationId) => {
      await admin.from("analysis_credit_reservations").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", reservationId).eq("user_id", userId).eq("status", "reserved");
    },
    resetSession: async (sessionId, userId, declaration) => {
      const { data, error } = await admin.rpc("reset_analysis_for_reanalysis", {
        p_session_id: sessionId,
        p_user_id: userId,
        p_declaration: declaration ?? null,
      });
      if (error) throw error;
      return data as ReanalysisResetOutcome;
    },
  });

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
