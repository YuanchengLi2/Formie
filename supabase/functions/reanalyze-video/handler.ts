import { parseSetDeclaration, type SetDeclaration } from "../_shared/set-declaration.ts";

export type ReanalysisResetOutcome = "ready" | "not_found" | "video_missing" | "busy" | "declaration_required";

export type ReanalyzeVideoDependencies = {
  authenticate: (request: Request) => Promise<string>;
  canonicalizeDeclaration: (declaration: SetDeclaration) => Promise<SetDeclaration>;
  verifyReusableInput: (sessionId: string, userId: string) => Promise<"ready" | "not_found" | "video_missing">;
  resetSession: (sessionId: string, userId: string, declaration?: SetDeclaration) => Promise<ReanalysisResetOutcome>;
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
  if (keys.some((key) => key !== "sessionId" && key !== "declaration") || typeof sessionId !== "string" || !sessionId.trim()) {
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
    const input = await dependencies.verifyReusableInput(sessionId, userId);
    if (input === "not_found") return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    if (input === "video_missing") return json({ message: "The original video is no longer available", code: "VIDEO_NOT_FOUND" }, 409);
    if (declaration) declaration = await dependencies.canonicalizeDeclaration(declaration);
    const outcome = await dependencies.resetSession(sessionId, userId, declaration);
    if (outcome === "not_found") return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    if (outcome === "video_missing") return json({ message: "The original video is no longer available", code: "VIDEO_NOT_FOUND" }, 409);
    if (outcome === "busy") return json({ message: "This analysis is already processing", code: "ALREADY_PROCESSING" }, 409);
    if (outcome === "declaration_required") return json({ message: "Confirm the exercise, completed amount, and load before reanalysis", code: "SET_DECLARATION_REQUIRED" }, 409);
    return json({ sessionId, status: "queued", stage: "video_check" }, 202);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    if (error instanceof Error && error.message === "INVALID_EXERCISE") return json({ message: "Selected exercise is unavailable", code: "INVALID_EXERCISE" }, 400);
    return json({ message: "The saved video could not be queued for reanalysis", code: "REANALYZE_FAILED" }, 500);
  }
}
