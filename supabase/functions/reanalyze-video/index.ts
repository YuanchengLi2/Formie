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
        .select("video_path,gemini_file_name")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return "not_found";
      return verifyRetainedAnalysisInput(
        { videoPath: data.video_path, geminiFileName: data.gemini_file_name },
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
