import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { requireCurrentAiEligibility } from "../_shared/ai-eligibility.ts";
import { secureBrowserRequest, withCors } from "../_shared/cors.ts";
import { createAnalysisHandler } from "./handler.ts";

Deno.serve(async (request) => {
  const security = await secureBrowserRequest(request, { methods: ["POST"], authentication: "user", maxBodyBytes: 16_384 });
  if (security) return security;
  const admin = createAdminClient();

  const response = await createAnalysisHandler(request, {
    authenticate: async (incoming) => {
      const userId = await requireUserId(incoming, admin);
      await requireCurrentAiEligibility(admin, userId);
      return userId;
    },
    ownsSession: async (sessionId, userId) => {
      const { data } = await admin.from("analysis_sessions").select("id").eq("id", sessionId).eq("user_id", userId).maybeSingle();
      return Boolean(data);
    },
    reserveCredit: async ({ userId, clientRequestId }) => {
      const { data, error } = await admin.rpc("reserve_analysis_credit_for_user", {
        p_user_id: userId,
        p_client_request_id: clientRequestId,
        p_kind: "analysis",
        p_session_id: null,
      });
      if (error) {
        const code = error.message.match(/ANALYSIS_[A-Z_]+/)?.[0] ?? "ANALYSIS_ACCESS_FAILED";
        throw Object.assign(new Error(error.message), { code });
      }
      const row = (Array.isArray(data) ? data[0] : data) as { reservation_id?: unknown; status?: unknown; remaining?: unknown; period_ends_at?: unknown; blocking_session_id?: unknown } | null;
      const pending = row?.status === "analysis_pending";
      if (!row || (!pending && typeof row.reservation_id !== "string")) throw Object.assign(new Error("Analysis access reservation was invalid"), { code: "ANALYSIS_ACCESS_FAILED" });
      return { reservationId: typeof row.reservation_id === "string" ? row.reservation_id : null, status: pending ? "analysis_pending" as const : row.status === "already_reserved" ? "already_reserved" as const : row.status === "request_terminal" ? "request_terminal" as const : "reserved" as const, blockingSessionId: typeof row.blocking_session_id === "string" ? row.blocking_session_id : null, remaining: typeof row.remaining === "number" ? row.remaining : null, periodEndsAt: typeof row.period_ends_at === "string" ? row.period_ends_at : null };
    },
    attachCredit: async (reservationId, sessionId) => {
      const { data: session, error: sessionError } = await admin.from("analysis_sessions").select("user_id").eq("id", sessionId).single();
      if (sessionError || !session?.user_id) throw sessionError ?? new Error("Analysis session owner is unavailable");
      const { data, error } = await admin.rpc("attach_analysis_reservation_to_session", {
        p_reservation_id: reservationId,
        p_session_id: sessionId,
        p_user_id: session.user_id,
      });
      if (error) throw error;
      if (typeof data !== "string") throw new Error("Analysis attempt was not created");
      return data;
    },
    cancelCredit: async (userId, reservationId) => {
      await admin.from("analysis_credit_reservations").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", reservationId).eq("user_id", userId).eq("status", "reserved");
    },
    findCatalogExercise: async (exerciseId) => {
      const { data, error } = await admin
        .from("exercise_variants_v2")
        .select("id,name")
        .eq("id", exerciseId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    createSession: async ({ userId, previousSessionId, clientRequestId, declaration }) => {
      const findExisting = async () => {
        if (!clientRequestId) return null;
        const { data, error } = await admin
          .from("analysis_sessions")
          .select("id")
          .eq("user_id", userId)
          .eq("client_request_id", clientRequestId)
          .maybeSingle();
        if (error) throw error;
        return data;
      };
      const existing = await findExisting();
      if (existing?.id) return { id: existing.id, userId, previousSessionId };

      const { data, error } = await admin
        .from("analysis_sessions")
        .insert({
          user_id: userId,
          previous_session_id: previousSessionId,
          client_request_id: clientRequestId,
          status: "uploading",
          upload_started_at: new Date().toISOString(),
          upload_completed_at: null,
          analysis_started_at: null,
          set_declaration: declaration,
          exercise_variant_v2_id: declaration.exercise.catalogExerciseId,
          detected_label: declaration.exercise.label,
          recognition_confidence: 1,
        })
        .select("id")
        .single();
      if (error) {
        if (clientRequestId && error.code === "23505") {
          const raced = await findExisting();
          if (raced?.id) return { id: raced.id, userId, previousSessionId };
        }
        throw error;
      }
      if (!data?.id) throw new Error("Analysis session could not be created");
      return { id: data.id, userId, previousSessionId };
    },
    createSignedUpload: async (path, options) => {
      const { data, error } = await admin.storage.from("analysis-videos").createSignedUploadUrl(path, options);
      if (error) throw error;
      return { signedUrl: data.signedUrl, token: data.token, path: data.path };
    },
  });

  return withCors(request, response);
});
