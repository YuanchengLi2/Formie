import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { exactFrameUploadPaths } from "../_shared/exact-frame-requests.ts";
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
        .select("id,video_path,analysis_video_path")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!session) return null;
      return {
        id: session.id,
        videoPath: session.video_path,
        analysisVideoPath: session.analysis_video_path,
        artifactPaths: exactFrameUploadPaths(userId, sessionId),
      };
    },
    removeVideos: async (paths) => {
      const { error } = await admin.storage.from("analysis-videos").remove(paths);
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
