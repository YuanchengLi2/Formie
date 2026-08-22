import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { historicalAnalysisArtifactPaths } from "../_shared/legacy-analysis-artifacts.ts";
import { deleteAnalysisHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["DELETE", "POST"], authentication: "user", maxBodyBytes: 4_096 });
  if (security) return security;
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
        artifactPaths: historicalAnalysisArtifactPaths(userId, sessionId),
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

  return withCors(request, response);
});
