import { createAdminClient } from "../_shared/auth.ts";
import { constantTimeEqual, validateRequestSecurity, withRequestIdentifier } from "../_shared/request-security.ts";
import { historicalAnalysisArtifactPaths } from "../_shared/legacy-analysis-artifacts.ts";
import { cleanupExpiredAnalysesHandler, type RetentionCandidate } from "./handler.ts";

function requireScheduledRequest(request: Request): Promise<void> {
  const authorization = request.headers.get("Authorization");
  const cronSecret = request.headers.get("x-cron-secret");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const configuredCronSecret = Deno.env.get("RETENTION_CLEANUP_SECRET");
  const authorized = Boolean(
    (serviceRoleKey && authorization && constantTimeEqual(authorization, `Bearer ${serviceRoleKey}`))
    || (configuredCronSecret && cronSecret && constantTimeEqual(cronSecret, configuredCronSecret)),
  );
  return authorized ? Promise.resolve() : Promise.reject(new Error("UNAUTHORIZED"));
}

Deno.serve(async (request) => {
  const security = await validateRequestSecurity(request, { methods: ["POST"], authentication: "webhook", maxBodyBytes: 4_096, allowBrowserOrigin: false });
  if (security) return security;
  const admin = createAdminClient();
  const response = await cleanupExpiredAnalysesHandler(request, {
    authenticate: requireScheduledRequest,
    findEligible: async (now) => {
      const { data: profiles, error: profileError } = await admin
        .from("user_profiles")
        .select("user_id,retention_effective_at")
        .eq("video_retention_days", 30)
        .not("retention_effective_at", "is", null);
      if (profileError) throw profileError;

      const candidates: RetentionCandidate[] = [];
      for (const profile of profiles ?? []) {
        const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000).toISOString();
        const { data: sessions, error: sessionError } = await admin
          .from("analysis_sessions")
          .select("id,user_id,video_path,analysis_video_path,created_at")
          .eq("user_id", profile.user_id)
          .gte("created_at", profile.retention_effective_at)
          .lte("created_at", cutoff)
          .order("created_at", { ascending: true })
          .limit(250);
        if (sessionError) throw sessionError;
        if (!sessions?.length) continue;

        const sessionIds = sessions.map((session) => session.id);
        const { data: poseArtifacts, error: artifactError } = await admin
          .from("pose_artifacts")
          .select("session_id,storage_path")
          .in("session_id", sessionIds);
        if (artifactError) throw artifactError;
        const poseBySession = new Map<string, string[]>();
        for (const artifact of poseArtifacts ?? []) {
          const paths = poseBySession.get(artifact.session_id) ?? [];
          paths.push(artifact.storage_path);
          poseBySession.set(artifact.session_id, paths);
        }

        for (const session of sessions) {
          candidates.push({
            id: session.id,
            videoPath: session.video_path,
            analysisVideoPath: session.analysis_video_path,
            artifactPaths: [
              ...(poseBySession.get(session.id) ?? []),
              ...historicalAnalysisArtifactPaths(session.user_id, session.id),
            ],
          });
        }
      }
      return candidates;
    },
    removeStorage: async (paths) => {
      const { error } = await admin.storage.from("analysis-videos").remove(paths);
      if (error) throw error;
    },
    deleteSession: async (sessionId) => {
      const { error } = await admin.from("analysis_sessions").delete().eq("id", sessionId);
      if (error) throw error;
    },
  });

  return withRequestIdentifier(request, response);
});
