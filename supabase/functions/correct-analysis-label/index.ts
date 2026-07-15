import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { preflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== "POST") return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  try {
    const admin = createAdminClient();
    const userId = await requireUserId(request, admin);
    const { sessionId, label } = await request.json() as { sessionId?: string; label?: string };
    const cleaned = label?.trim();
    if (!sessionId || !cleaned || cleaned.length > 120) return errorResponse("A valid sessionId and label are required", 400, "INVALID_BODY");
    const { data, error } = await admin.from("analysis_sessions").update({ corrected_label: cleaned, updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", userId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return errorResponse("Analysis not found", 404, "NOT_FOUND");
    return jsonResponse({ corrected: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("Sign in again", 401, "UNAUTHORIZED");
    return errorResponse("Exercise name could not be corrected", 500, "CORRECTION_FAILED");
  }
});
