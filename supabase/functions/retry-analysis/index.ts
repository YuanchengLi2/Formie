import { createAdminClient } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { retryAnalysisHandler } from "./handler.ts";
import { isV49PrimaryRolloutEnabled } from "../_shared/v49-primary-rollout.ts";

function requireScheduledRequest(request: Request): Promise<void> {
  const supplied = request.headers.get("x-cron-secret");
  const configured = Deno.env.get("ANALYSIS_RETRY_SECRET") ?? Deno.env.get("RETENTION_CLEANUP_SECRET");
  return configured && supplied === configured ? Promise.resolve() : Promise.reject(new Error("UNAUTHORIZED"));
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();
  const primaryV49Enabled = isV49PrimaryRolloutEnabled(Deno.env.get("ANALYSIS_V49_PRIMARY_ENABLED"));
  const response = await retryAnalysisHandler(request, {
    primaryV49Enabled,
    authenticate: requireScheduledRequest,
    findDueSessions: async (now, limit) => {
      let query = admin
        .from("analysis_sessions")
        .select("id,user_id,active_v49_run_id,pipeline_version,analysis_next_retry_at")
        .eq("status", "processing");
      query = primaryV49Enabled
        ? query.not("active_v49_run_id", "is", null)
        : query.is("active_v49_run_id", null);
      const stages = primaryV49Enabled
        ? ["input_ready", "video_processing", "problem_finding", "coaching", "committing", "retry_wait"]
        : ["input_ready", "video_processing", "analyzing", "finalizing", "retry_wait"];
      const { data, error } = await query
        .in("stage", stages)
        .or(`analysis_next_retry_at.is.null,analysis_next_retry_at.lte.${now.toISOString()}`)
        .order("analysis_next_retry_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((session) => ({
        id: session.id,
        userId: session.user_id,
        pipelineVersion: session.pipeline_version ?? null,
        analysisNextRetryAt: session.analysis_next_retry_at ?? null,
      }));
    },
    invokeAnalysis: async (session) => {
      const endpoint = primaryV49Enabled ? "analyze-video-v49" : "analyze-video";
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
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
