export type CancelAnalysisDependencies = {
  authenticate: (request: Request) => Promise<string>;
  cancel: (userId: string, input: { reservationId?: string; sessionId?: string; reason?: "upload_failed" | "user_discarded" }) => Promise<{ cancelled: boolean; sessionFailed: boolean; reservationCancelled: boolean; access: unknown }>;
  cleanupUpload?: (userId: string, sessionId: string) => Promise<void>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function cancelAnalysisHandler(request: Request, dependencies: CancelAnalysisDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ message: "Invalid request", code: "INVALID_BODY" }, 400); }
  const reservationId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).reservationId === "string" ? String((body as Record<string, unknown>).reservationId) : undefined;
  const sessionId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).sessionId === "string" ? String((body as Record<string, unknown>).sessionId) : undefined;
  const rawReason = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).reason : undefined;
  const reason = rawReason === "upload_failed" || rawReason === "user_discarded" ? rawReason : undefined;
  if (rawReason !== undefined && !reason) return json({ message: "Invalid cancellation reason", code: "INVALID_BODY" }, 400);
  if (reason && !sessionId) return json({ message: "sessionId is required for upload cancellation", code: "INVALID_BODY" }, 400);
  if (!reservationId && !sessionId) return json({ message: "reservationId or sessionId is required", code: "INVALID_BODY" }, 400);
  try {
    const userId = await dependencies.authenticate(request);
    const result = await dependencies.cancel(userId, { reservationId, sessionId, reason });
    if (result.sessionFailed && sessionId && dependencies.cleanupUpload) {
      await dependencies.cleanupUpload(userId, sessionId).catch(() => undefined);
    }
    return json(result, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    return json({ message: "Analysis cancellation failed", code: "CANCEL_FAILED" }, 500);
  }
}
