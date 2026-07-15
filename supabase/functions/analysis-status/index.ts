import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { preflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";

function resultPayload(session: Record<string, unknown>, result: Record<string, unknown> | null) {
  if (!result) return null;
  return {
    status: result.status,
    recognition: {
      label: session.corrected_label ?? session.detected_label,
      variation: session.detected_variation,
      equipment: session.detected_equipment ?? [],
      confidence: Number(session.recognition_confidence ?? 0),
      alternatives: session.recognition_alternatives ?? [],
      catalogExerciseId: session.corrected_exercise_id ?? session.exercise_id,
    },
    videoCheck: result.video_check,
    overallAssessment: result.overall_assessment,
    score: result.score === null ? null : Number(result.score),
    scoreRationale: result.score_rationale ?? [],
    didWell: result.did_well ?? [],
    priorityCorrections: result.priority_corrections ?? [],
    coachingCues: result.coaching_cues ?? [],
    viewNote: result.view_note,
    comparison: result.comparison,
  };
}

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

    return jsonResponse({ sessionId, status: session.status, stage: session.stage, videoUrl, result: resultPayload(session, result) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("Sign in again", 401, "UNAUTHORIZED");
    return errorResponse("Analysis status could not be loaded", 500, "STATUS_FAILED");
  }
});
