import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { cancelAnalysisHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "user", maxBodyBytes: 4_096 });
  if (security) return security;
  const admin = createAdminClient();
  const response = await cancelAnalysisHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    cancel: async (userId, input) => {
      let query = admin.from("analysis_credit_reservations").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("user_id", userId).eq("status", "reserved");
      if (input.reservationId) query = query.eq("id", input.reservationId);
      if (input.sessionId) query = query.eq("session_id", input.sessionId);
      const { data, error } = await query.select("id").maybeSingle();
      if (error) throw error;
      const { data: accessData, error: accessError } = await admin.rpc("get_access_status_for_user", { p_user_id: userId });
      if (accessError) throw accessError;
      return { cancelled: Boolean(data), access: Array.isArray(accessData) ? accessData[0] ?? null : accessData };
    },
  });
  return withCors(request, response);
});
