export type CompleteUploadSession = {
  id: string;
  videoPath: string | null;
};

export type CompleteUploadDependencies = {
  authenticate: (request: Request) => Promise<string>;
  findSession: (sessionId: string, userId: string) => Promise<CompleteUploadSession | null>;
  videoExists: (path: string) => Promise<boolean>;
  markProcessing: (input: {
    sessionId: string;
    userId: string;
    videoPath: string;
    durationMs: number;
    requestedFps: 24;
  }) => Promise<void>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function completeUploadHandler(request: Request, dependencies: CompleteUploadDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ message: "A JSON request body is required", code: "INVALID_BODY" }, 400);
  }

  const { sessionId, durationMs } = body;
  if (
    typeof sessionId !== "string" || !sessionId ||
    typeof durationMs !== "number" || !Number.isInteger(durationMs) || durationMs < 3_000 || durationMs > 60_000
  ) {
    return json({ message: "Invalid upload metadata", code: "INVALID_BODY" }, 400);
  }

  try {
    const userId = await dependencies.authenticate(request);
    const session = await dependencies.findSession(sessionId, userId);
    if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);

    const videoPath = session.videoPath ?? `${userId}/${sessionId}/original.mp4`;
    if (!(await dependencies.videoExists(videoPath))) {
      return json({ message: "The uploaded video was not found", code: "VIDEO_NOT_FOUND" }, 409);
    }

    await dependencies.markProcessing({
      sessionId,
      userId,
      videoPath,
      durationMs,
      requestedFps: 24,
    });
    return json({ processing: true }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    }
    return json({ message: "Upload could not be completed", code: "COMPLETE_FAILED" }, 500);
  }
}
