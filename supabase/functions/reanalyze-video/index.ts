import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { reanalyzeVideoHandler, type ReanalysisResetOutcome } from "./handler.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();

  const response = await reanalyzeVideoHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    resetSession: async (sessionId, userId) => {
      const { data, error } = await admin.rpc("reset_analysis_for_reanalysis", {
        p_session_id: sessionId,
        p_user_id: userId,
      });
      if (error) throw error;
      return data as ReanalysisResetOutcome;
    },
  });

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});
