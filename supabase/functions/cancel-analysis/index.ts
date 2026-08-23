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
      let sessionFailed = false;
      let reservationCancelled = false;
      if (input.sessionId && input.reason) {
        const { data, error } = await admin.rpc("fail_preprocessing_analysis", {
          p_user_id: userId,
          p_session_id: input.sessionId,
          p_reservation_id: input.reservationId ?? null,
          p_failure_code: input.reason === "upload_failed" ? "UPLOAD_FAILED" : "UPLOAD_CANCELLED",
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        sessionFailed = Boolean(row?.session_failed);
        reservationCancelled = Boolean(row?.reservation_cancelled);
      } else {
        let query = admin.from("analysis_credit_reservations").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("user_id", userId).eq("status", "reserved");
        if (input.reservationId) query = query.eq("id", input.reservationId);
        if (input.sessionId) query = query.eq("session_id", input.sessionId);
        const { data, error } = await query.select("id").maybeSingle();
        if (error) throw error;
        reservationCancelled = Boolean(data);
      }
      const { data: accessData, error: accessError } = await admin.rpc("get_access_status_for_user", { p_user_id: userId });
      if (accessError) throw accessError;
      return {
        cancelled: sessionFailed || reservationCancelled,
        sessionFailed,
        reservationCancelled,
        access: Array.isArray(accessData) ? accessData[0] ?? null : accessData,
      };
    },
    cleanupUpload: async (userId, sessionId) => {
      const path = `${userId}/${sessionId}/analysis-input.mp4`;
      const { error } = await admin.storage.from("analysis-videos").remove([path]);
      if (error) console.error("Preprocessing upload cleanup failed", { sessionId, message: error.message });
    },
  });
  return withCors(request, response);
});
