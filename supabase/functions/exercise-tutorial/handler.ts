import type { TutorialVideo } from "../_shared/youtube-tutorial.ts";

export type ExerciseTutorialSession = {
  id: string;
  status: string;
  catalogExerciseId: number | null;
  canonicalLabel: string | null;
};

export type ExerciseTutorialDependencies = {
  authenticate: (request: Request) => Promise<string>;
  loadSession: (sessionId: string, userId: string) => Promise<ExerciseTutorialSession | null>;
  resolveTutorial: (exerciseLabel: string) => Promise<TutorialVideo | null>;
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function exerciseTutorialHandler(request: Request, dependencies: ExerciseTutorialDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  let sessionId: string | undefined;
  try {
    ({ sessionId } = await request.json() as { sessionId?: string });
  } catch {
    return json({ message: "A valid sessionId is required", code: "INVALID_BODY" }, 400);
  }
  if (!sessionId) return json({ message: "sessionId is required", code: "INVALID_BODY" }, 400);

  try {
    const userId = await dependencies.authenticate(request);
    const session = await dependencies.loadSession(sessionId, userId);
    if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    if (!session.catalogExerciseId || !session.canonicalLabel || !["complete", "partial"].includes(session.status)) return json({ tutorial: null });
    const tutorial = await dependencies.resolveTutorial(session.canonicalLabel);
    return json({ tutorial });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    return json({ message: "A tutorial could not be selected right now", code: "TUTORIAL_FAILED" }, 502);
  }
}
