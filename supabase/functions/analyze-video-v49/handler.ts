export type V49Run = { runId: string; sessionId: string; userId: string; mode: "primary" | "shadow"; [key: string]: unknown };
export type V49HandlerDependencies = {
  authenticate: (request: Request) => Promise<{ userId: string; allowShadow: boolean }>;
  loadRun: (sessionId: string, userId: string, requestedRunId?: string) => Promise<V49Run | null>;
  execute: (run: V49Run) => Promise<{ status: string; stage: string; result?: unknown; failureReason?: unknown }>;
};

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

export async function analyzeVideoV49Handler(request: Request, dependencies: V49HandlerDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    body = value as Record<string, unknown>;
  } catch {
    return json({ message: "A valid sessionId is required", code: "INVALID_BODY" }, 400);
  }
  if (Object.keys(body).some((key) => key !== "sessionId" && key !== "runId") || typeof body.sessionId !== "string" || !body.sessionId.trim() || (body.runId !== undefined && (typeof body.runId !== "string" || !body.runId.trim()))) return json({ message: "A valid sessionId is required", code: "INVALID_BODY" }, 400);
  try {
    const auth = await dependencies.authenticate(request);
    if (body.runId && !auth.allowShadow) return json({ message: "Shadow analysis is not allowed", code: "FORBIDDEN" }, 403);
    const run = await dependencies.loadRun(body.sessionId, auth.userId, body.runId as string | undefined);
    if (!run) return json({ message: "Analysis run not found", code: "NOT_FOUND" }, 404);
    if (run.mode === "shadow" && !auth.allowShadow) return json({ message: "Shadow analysis is not allowed", code: "FORBIDDEN" }, 403);
    const output = await dependencies.execute(run);
    return json({ sessionId: body.sessionId, runId: run.runId, ...output }, output.status === "complete" || output.status === "unable" ? 200 : 202);
  } catch (error) {
    const eligibility = aiEligibilityErrorResponse(error);
    if (eligibility) return eligibility;
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    throw error;
  }
}
import { aiEligibilityErrorResponse } from "../_shared/ai-eligibility.ts";
