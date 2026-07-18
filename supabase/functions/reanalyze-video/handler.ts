export type ReanalysisResetOutcome = "ready" | "not_found" | "video_missing" | "busy";

export type ReanalyzeVideoDependencies = {
  authenticate: (request: Request) => Promise<string>;
  resetSession: (sessionId: string, userId: string) => Promise<ReanalysisResetOutcome>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function reanalyzeVideoHandler(request: Request, dependencies: ReanalyzeVideoDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ message: "A JSON request body is required", code: "INVALID_BODY" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ message: "Invalid request body", code: "INVALID_BODY" }, 400);
  const keys = Object.keys(body);
  const sessionId = (body as { sessionId?: unknown }).sessionId;
  if (keys.length !== 1 || keys[0] !== "sessionId" || typeof sessionId !== "string" || !sessionId.trim()) {
    return json({ message: "sessionId is required", code: "INVALID_BODY" }, 400);
  }

  try {
    const userId = await dependencies.authenticate(request);
    const outcome = await dependencies.resetSession(sessionId, userId);
    if (outcome === "not_found") return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    if (outcome === "video_missing") return json({ message: "The original video is no longer available", code: "VIDEO_NOT_FOUND" }, 409);
    if (outcome === "busy") return json({ message: "This analysis is already processing", code: "ALREADY_PROCESSING" }, 409);
    return json({ sessionId, status: "queued", stage: "video_check" }, 202);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    return json({ message: "The saved video could not be queued for reanalysis", code: "REANALYZE_FAILED" }, 500);
  }
}
