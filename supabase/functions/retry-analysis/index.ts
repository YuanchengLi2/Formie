import { createAdminClient } from "../_shared/auth.ts";
import { constantTimeEqual, validateRequestSecurity, withRequestIdentifier } from "../_shared/request-security.ts";
import { retryAnalysisHandler } from "./handler.ts";
import { isV49PrimaryRolloutEnabled } from "../_shared/v49-primary-rollout.ts";

function requireScheduledRequest(request: Request): Promise<void> {
  const supplied = request.headers.get("x-cron-secret");
  const configured = Deno.env.get("ANALYSIS_RETRY_SECRET") ?? Deno.env.get("RETENTION_CLEANUP_SECRET");
  return configured && supplied && constantTimeEqual(supplied, configured) ? Promise.resolve() : Promise.reject(new Error("UNAUTHORIZED"));
}

Deno.serve(async (request) => {
  const security = await validateRequestSecurity(request, { methods: ["POST"], authentication: "webhook", maxBodyBytes: 4_096, allowBrowserOrigin: false });
  if (security) return security;
  const admin = createAdminClient();
  const primaryV49Enabled = isV49PrimaryRolloutEnabled(Deno.env.get("ANALYSIS_V49_PRIMARY_ENABLED"));
  const response = await retryAnalysisHandler(request, {
    primaryV49Enabled,
    authenticate: requireScheduledRequest,
    findDueSessions: async (now, limit) => {
      let query = admin
        .from("analysis_sessions")
        .select("id,user_id,active_v49_run_id,pipeline_version,analysis_next_retry_at,updated_at")
        .eq("status", "processing");
      if (!primaryV49Enabled) query = query.is("active_v49_run_id", null);
      const stages = ["input_ready", "video_processing", "problem_finding", "coaching", "committing", "analyzing", "finalizing", "retry_wait"];
      const { data, error } = await query
        .in("stage", stages)
        .or(`analysis_next_retry_at.is.null,analysis_next_retry_at.lte.${now.toISOString()}`)
        .order("analysis_next_retry_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      const sessions = data ?? [];
      const failedStageBySession = new Map<string, { pipelineVersion: string | null; updatedAt: string }>();
      if (sessions.length > 0) {
        const { data: failedStages, error: failedStagesError } = await admin
          .from("analysis_stage_runs")
          .select("session_id,pipeline_version,updated_at")
          .in("session_id", sessions.map((session) => session.id))
          .eq("status", "failed")
          .order("updated_at", { ascending: false });
        if (failedStagesError) throw failedStagesError;
        for (const stage of failedStages ?? []) {
          if (!failedStageBySession.has(stage.session_id)) {
            failedStageBySession.set(stage.session_id, {
              pipelineVersion: stage.pipeline_version ?? null,
              updatedAt: stage.updated_at,
            });
          }
        }
      }
      return sessions.map((session) => {
        const failedStage = failedStageBySession.get(session.id);
        const hasUnreconciledStageFailure = Boolean(
          failedStage
          && failedStage.pipelineVersion === session.pipeline_version
          && Date.parse(failedStage.updatedAt) >= Date.parse(session.updated_at),
        );
        return {
            id: session.id,
            userId: session.user_id,
            activeV49RunId: session.active_v49_run_id ?? null,
            pipelineVersion: session.pipeline_version ?? null,
            analysisNextRetryAt: session.analysis_next_retry_at ?? null,
            hasUnreconciledStageFailure,
          };
      });
    },
    invokeAnalysis: async (session) => {
      const endpoint = primaryV49Enabled && session.activeV49RunId ? "analyze-video-v49" : "analyze-video";
      const url = `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/${endpoint}`;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const retrySecret = Deno.env.get("ANALYSIS_RETRY_SECRET") ?? Deno.env.get("RETENTION_CLEANUP_SECRET") ?? "";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
          "x-analysis-retry-secret": retrySecret,
          "x-analysis-retry-user-id": session.userId,
        },
        body: JSON.stringify({ sessionId: session.id }),
      });
      return response.status;
    },
  });
  return withRequestIdentifier(request, response);
});
