import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { preflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/responses.ts";
import { resultPayload } from "../_shared/result-payload.ts";
import { playbackWindowFromSession } from "../_shared/analysis-playback-window.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  if (request.method !== "GET") return errorResponse("Method not allowed", 405, "METHOD_NOT_ALLOWED");

  try {
    const admin = createAdminClient();
    const userId = await requireUserId(request, admin);
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    if (!sessionId) return errorResponse("sessionId is required", 400, "INVALID_QUERY");
    const { data: session, error: sessionError } = await admin.from("analysis_sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return errorResponse("Analysis not found", 404, "NOT_FOUND");
    const { data: result, error: resultError } = await admin.from("analysis_results").select("*").eq("session_id", sessionId).maybeSingle();
    if (resultError) throw resultError;
    const { data: v49Run, error: v49Error } = session.active_v49_run_id
      ? await admin.from("analysis_v49_runs").select("run_id,status,failure_reason,public_result").eq("run_id", session.active_v49_run_id).eq("session_id", sessionId).maybeSingle()
      : { data: null, error: null };
    if (v49Error) throw v49Error;

    let videoUrl: string | null = null;
    if (session.video_path) {
      const signed = await admin.storage.from("analysis-videos").createSignedUrl(session.video_path, 900);
      videoUrl = signed.data?.signedUrl ?? null;
    }

    const payload = resultPayload(session, result, v49Run?.public_result ?? null);
    return jsonResponse({
      sessionId,
      status: session.status,
      stage: session.stage,
      failureCode: session.failure_code ?? null,
      failureReason: typeof v49Run?.failure_reason?.message === "string" ? v49Run.failure_reason.message : null,
      analysisNextRetryAt: session.analysis_next_retry_at ?? null,
      durationMs: session.duration_ms,
      playbackWindow: playbackWindowFromSession(session),
      videoUrl,
      setDeclaration: session.set_declaration ?? null,
      result: payload,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("Sign in again", 401, "UNAUTHORIZED");
    return errorResponse("Analysis status could not be loaded", 500, "STATUS_FAILED");
  }
});
