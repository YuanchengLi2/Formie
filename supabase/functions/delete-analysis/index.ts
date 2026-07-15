import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { preflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== "DELETE" && request.method !== "POST") return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  try {
    const admin = createAdminClient();
    const userId = await requireUserId(request, admin);
    const { sessionId } = await request.json() as { sessionId?: string };
    if (!sessionId) return errorResponse("sessionId is required", 400, "INVALID_BODY");
    const { data: session } = await admin.from("analysis_sessions").select("id,video_path").eq("id", sessionId).eq("user_id", userId).maybeSingle();
    if (!session) return errorResponse("Analysis not found", 404, "NOT_FOUND");
    if (session.video_path) await admin.storage.from("analysis-videos").remove([session.video_path]);
    const { error } = await admin.from("analysis_sessions").delete().eq("id", sessionId).eq("user_id", userId);
    if (error) throw error;
    return jsonResponse({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("Sign in again", 401, "UNAUTHORIZED");
    return errorResponse("Analysis could not be deleted", 500, "DELETE_FAILED");
  }
});
