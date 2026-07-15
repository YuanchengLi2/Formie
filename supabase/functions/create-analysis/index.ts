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
    insertSession: async ({ userId, previousSessionId }) => {
      const { data, error } = await admin
        .from("analysis_sessions")
        .insert({ user_id: userId, previous_session_id: previousSessionId, status: "uploading" })
        .select("id,user_id,previous_session_id")
        .single();
      if (error) throw error;
      return { id: data.id, userId: data.user_id, previousSessionId: data.previous_session_id };
    },
    createSignedUpload: async (path) => {
      const { data, error } = await admin.storage.from("analysis-videos").createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return { signedUrl: data.signedUrl, token: data.token, path: data.path };
    },
  });

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
