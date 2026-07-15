export type CreateAnalysisDependencies = {
  authenticate: (request: Request) => Promise<string>;
  ownsSession: (sessionId: string, userId: string) => Promise<boolean>;
  insertSession: (input: { userId: string; previousSessionId: string | null }) => Promise<{ id: string; userId: string; previousSessionId: string | null }>;
  createSignedUpload: (path: string) => Promise<{ signedUrl: string; token: string; path: string }>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function createAnalysisHandler(request: Request, dependencies: CreateAnalysisDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ message: "A JSON request body is required", code: "INVALID_BODY" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ message: "Invalid request body", code: "INVALID_BODY" }, 400);
  const keys = Object.keys(body);
  if (keys.some((key) => key !== "previousSessionId")) {
    return json({ message: "Exercise selection is not accepted; FORM recognizes the recording automatically", code: "INVALID_BODY" }, 400);
  }

  const previousSessionId = "previousSessionId" in body ? (body as { previousSessionId?: unknown }).previousSessionId : null;
  if (previousSessionId !== null && previousSessionId !== undefined && typeof previousSessionId !== "string") {
    return json({ message: "previousSessionId must be a string", code: "INVALID_BODY" }, 400);
  }

  try {
    const userId = await dependencies.authenticate(request);
    const normalizedPreviousId = previousSessionId || null;
    if (normalizedPreviousId && !(await dependencies.ownsSession(normalizedPreviousId, userId))) {
      return json({ message: "Previous analysis not found", code: "NOT_FOUND" }, 404);
    }

    const session = await dependencies.insertSession({ userId, previousSessionId: normalizedPreviousId });
    const path = `${userId}/${session.id}/original.mp4`;
    const upload = await dependencies.createSignedUpload(path);
    return json({ sessionId: session.id, upload }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    return json({ message: "Analysis session could not be created", code: "CREATE_FAILED" }, 500);
  }
}
