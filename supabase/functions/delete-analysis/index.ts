import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { deleteAnalysisHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();
  const response = await deleteAnalysisHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    findSession: async (sessionId, userId) => {
      const { data: session, error: sessionError } = await admin
        .from("analysis_sessions")
        .select("id,video_path")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!session) return null;
      const { data: artifacts, error: artifactError } = await admin
        .from("pose_artifacts")
        .select("storage_path")
        .eq("session_id", sessionId);
      if (artifactError) throw artifactError;
      return {
        id: session.id,
        videoPath: session.video_path,
        artifactPaths: (artifacts ?? []).map((artifact) => artifact.storage_path),
      };
    },
    removeVideos: async (paths) => {
      const { error } = await admin.storage.from("analysis-videos").remove(paths);
      if (error) throw error;
    },
    removeArtifacts: async (paths) => {
      const { error } = await admin.storage.from("analysis-artifacts").remove(paths);
      if (error) throw error;
    },
    deleteSession: async (sessionId, userId) => {
      const { error } = await admin.from("analysis_sessions").delete().eq("id", sessionId).eq("user_id", userId);
      if (error) throw error;
    },
  });

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
