import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { preflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { resultPayload } from "../_shared/result-payload.ts";
import { buildEvidenceOverlays } from "../_shared/evidence-overlay.ts";
import { poseTrackingFromSummary, validatePoseSummary, type PoseSummary } from "../_shared/pose-summary.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== "GET") return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");

  try {
    const admin = createAdminClient();
    const userId = await requireUserId(request, admin);
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (!sessionId) return errorResponse("sessionId is required", 400, "INVALID_QUERY");
    const { data: session } = await admin.from("analysis_sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle();
    if (!session) return errorResponse("Analysis not found", 404, "NOT_FOUND");
    const { data: result } = await admin.from("analysis_results").select("*").eq("session_id", sessionId).maybeSingle();

    let videoUrl: string | null = null;
    if (session.video_path && result) {
      const signed = await admin.storage.from("analysis-videos").createSignedUrl(session.video_path, 900);
      videoUrl = signed.data?.signedUrl ?? null;
    }

    let poseSummary: PoseSummary | null = null;
    let poseTracking = null;
    if (session.pose_summary && session.duration_ms) {
      try {
        poseSummary = validatePoseSummary(session.pose_summary, session.duration_ms);
        poseTracking = poseTrackingFromSummary(poseSummary);
      } catch {
        poseSummary = null;
        poseTracking = null;
      }
    }

    const payload = resultPayload(session, result);
    const findings = payload ? [...payload.didWell, ...payload.priorityCorrections, ...payload.coachingCues] : [];
    const evidenceOverlays = poseSummary ? buildEvidenceOverlays(poseSummary, findings) : [];

    return jsonResponse({ sessionId, status: session.status, stage: session.stage, durationMs: session.duration_ms, videoUrl, poseTracking, evidenceOverlays, result: payload });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("Sign in again", 401, "UNAUTHORIZED");
    return errorResponse("Analysis status could not be loaded", 500, "STATUS_FAILED");
  }
});
