import { parseSetDeclaration, type SetDeclaration } from "../_shared/set-declaration.ts";

export type ReanalysisResetOutcome = "ready" | "not_found" | "video_missing" | "video_too_long" | "busy" | "declaration_required";

export type ReanalyzeVideoDependencies = {
  authenticate: (request: Request) => Promise<string>;
  canonicalizeDeclaration: (declaration: SetDeclaration) => Promise<SetDeclaration>;
  verifyReusableInput: (sessionId: string, userId: string) => Promise<"ready" | "not_found" | "video_missing" | "video_too_long">;
  resetSession: (sessionId: string, userId: string, declaration?: SetDeclaration) => Promise<ReanalysisResetOutcome>;
  reserveCredit?: (input: { userId: string; sessionId: string; clientRequestId: string }) => Promise<{ reservationId: string | null; status?: "reserved" | "already_reserved" | "analysis_pending"; blockingSessionId?: string | null; remaining: number | null; periodEndsAt: string | null }>;
  cancelCredit?: (userId: string, reservationId: string) => Promise<void>;
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
  if (keys.some((key) => key !== "sessionId" && key !== "declaration" && key !== "clientRequestId") || typeof sessionId !== "string" || !sessionId.trim()) {
    return json({ message: "sessionId is required", code: "INVALID_BODY" }, 400);
  }
  let declaration: SetDeclaration | undefined;
  if ("declaration" in body) {
    try {
      declaration = parseSetDeclaration((body as { declaration?: unknown }).declaration);
    } catch (error) {
      return json({ message: error instanceof Error ? error.message : "Set declaration is invalid", code: "INVALID_BODY" }, 400);
    }
  }

  try {
    const userId = await dependencies.authenticate(request);
    const rawRequestId = (body as { clientRequestId?: unknown }).clientRequestId;
    const clientRequestId = typeof rawRequestId === "string" && rawRequestId.trim().length >= 8
      ? rawRequestId.trim()
      : `reanalysis-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const input = await dependencies.verifyReusableInput(sessionId, userId);
    if (input === "not_found") return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    if (input === "video_missing") return json({ message: "The original video is no longer available", code: "VIDEO_NOT_FOUND" }, 409);
    if (input === "video_too_long") return json({ message: "Video inputs are limited to 15 seconds", code: "VIDEO_TOO_LONG" }, 409);
    if (declaration) declaration = await dependencies.canonicalizeDeclaration(declaration);
    let reservation: { reservationId: string | null; status?: "reserved" | "already_reserved" | "analysis_pending"; blockingSessionId?: string | null; remaining: number | null; periodEndsAt: string | null } | null = null;
    try {
      if (dependencies.reserveCredit) reservation = await dependencies.reserveCredit({ userId, sessionId, clientRequestId });
      if (reservation?.status === "analysis_pending") return json({ message: "An analysis is already in progress", code: "ANALYSIS_PENDING", sessionId: reservation.blockingSessionId, remaining: reservation.remaining, periodEndsAt: reservation.periodEndsAt }, 409);
      const outcome = await dependencies.resetSession(sessionId, userId, declaration);
      if (outcome !== "ready" && reservation?.reservationId && dependencies.cancelCredit) await dependencies.cancelCredit(userId, reservation.reservationId).catch(() => undefined);
      if (outcome === "not_found") return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
      if (outcome === "video_missing") return json({ message: "The original video is no longer available", code: "VIDEO_NOT_FOUND" }, 409);
      if (outcome === "video_too_long") return json({ message: "Video inputs are limited to 15 seconds", code: "VIDEO_TOO_LONG" }, 409);
      if (outcome === "busy") return json({ message: "This analysis is already processing", code: "ALREADY_PROCESSING" }, 409);
      if (outcome === "declaration_required") return json({ message: "Confirm the exercise, completed amount, and load before reanalysis", code: "SET_DECLARATION_REQUIRED" }, 409);
      return json({ sessionId, status: "queued", stage: "input_ready", reservationId: reservation?.reservationId, remaining: reservation?.remaining, periodEndsAt: reservation?.periodEndsAt }, 202);
    } catch (error) {
      if (reservation?.reservationId && dependencies.cancelCredit) await dependencies.cancelCredit(userId, reservation.reservationId).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    if (error instanceof Error && error.message === "INVALID_EXERCISE") return json({ message: "Selected exercise is unavailable", code: "INVALID_EXERCISE" }, 400);
    if (error && typeof error === "object" && "code" in error && String((error as { code?: unknown }).code).startsWith("ANALYSIS_")) return json({ message: error instanceof Error ? error.message : "Analysis access is unavailable", code: String((error as { code?: unknown }).code) }, 402);
    return json({ message: "The saved video could not be queued for reanalysis", code: "REANALYZE_FAILED" }, 500);
  }
}
