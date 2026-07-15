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
    const { sessionId } = await request.json() as { sessionId?: string };
    if (!sessionId) return errorResponse("sessionId is required", 400, "INVALID_BODY");

    const { data: session } = await admin.from("analysis_sessions").select("id,video_path").eq("id", sessionId).eq("user_id", userId).maybeSingle();
    if (!session) return errorResponse("Analysis not found", 404, "NOT_FOUND");
    const videoPath = session.video_path ?? `${userId}/${sessionId}/original.mp4`;
    const { data: exists, error: existsError } = await admin.storage.from("analysis-videos").exists(videoPath);
    if (existsError || !exists) return errorResponse("The uploaded video was not found", 409, "VIDEO_NOT_FOUND");

    const { error: updateError } = await admin.from("analysis_sessions").update({ status: "queued", stage: "video_check", video_path: videoPath, updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", userId);
    if (updateError) throw updateError;
    const { error: jobError } = await admin.from("analysis_jobs").upsert({ session_id: sessionId, stage: "queued", updated_at: new Date().toISOString() }, { onConflict: "session_id" });
    if (jobError) throw jobError;
    return jsonResponse({ queued: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("Sign in again", 401, "UNAUTHORIZED");
    return errorResponse("Upload could not be queued", 500, "QUEUE_FAILED");
  }
});
