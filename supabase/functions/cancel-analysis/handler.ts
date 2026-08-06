export type CancelAnalysisDependencies = {
  authenticate: (request: Request) => Promise<string>;
  cancel: (userId: string, input: { reservationId?: string; sessionId?: string }) => Promise<{ cancelled: boolean; access: unknown }>;
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
  if (!reservationId && !sessionId) return json({ message: "reservationId or sessionId is required", code: "INVALID_BODY" }, 400);
  try {
    const userId = await dependencies.authenticate(request);
    const result = await dependencies.cancel(userId, { reservationId, sessionId });
    return json(result, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    return json({ message: "Analysis cancellation failed", code: "CANCEL_FAILED" }, 500);
  }
}
