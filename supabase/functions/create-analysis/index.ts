import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { createAnalysisHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();

  const response = await createAnalysisHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    ownsSession: async (sessionId, userId) => {
      const { data } = await admin.from("analysis_sessions").select("id").eq("id", sessionId).eq("user_id", userId).maybeSingle();
      return Boolean(data);
    },
    findCatalogExercise: async (exerciseId) => {
      const { data, error } = await admin
        .from("exercise_variants_v2")
        .select("id,name")
        .eq("id", exerciseId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    createSession: async ({ userId, previousSessionId, clientRequestId, declaration }) => {
      const { data, error } = await admin
        .from("analysis_sessions")
        .upsert({
          user_id: userId,
          previous_session_id: previousSessionId,
          client_request_id: clientRequestId,
          status: "uploading",
          upload_started_at: new Date().toISOString(),
          upload_completed_at: null,
          analysis_started_at: null,
          set_declaration: declaration,
          exercise_variant_v2_id: declaration.exercise.catalogExerciseId,
          detected_label: declaration.exercise.label,
          recognition_confidence: 1,
        }, { onConflict: "user_id,client_request_id" })
        .select("id")
        .single();
      if (error || !data?.id) throw error ?? new Error("Analysis session could not be created");
      return { id: data.id, userId, previousSessionId };
    },
    createSignedUpload: async (path, options) => {
      const { data, error } = await admin.storage.from("analysis-videos").createSignedUploadUrl(path, options);
      if (error) throw error;
      return { signedUrl: data.signedUrl, token: data.token, path: data.path };
    },
  });

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
