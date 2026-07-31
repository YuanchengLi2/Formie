export type DeleteAnalysisSession = {
  id: string;
  videoPath: string | null;
  analysisVideoPath: string | null;
  artifactPaths: string[];
};

export type DeleteAnalysisDependencies = {
  authenticate: (request: Request) => Promise<string>;
  findSession: (sessionId: string, userId: string) => Promise<DeleteAnalysisSession | null>;
  removeVideos: (paths: string[]) => Promise<void>;
  deleteSession: (sessionId: string, userId: string) => Promise<void>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function deleteAnalysisHandler(request: Request, dependencies: DeleteAnalysisDependencies): Promise<Response> {
  if (request.method !== "DELETE" && request.method !== "POST") {
    return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  }

  let sessionId: string | undefined;
  try {
    ({ sessionId } = await request.json() as { sessionId?: string });
  } catch {
    return json({ message: "A valid sessionId is required", code: "INVALID_BODY" }, 400);
  }
  if (!sessionId) return json({ message: "sessionId is required", code: "INVALID_BODY" }, 400);

  try {
    const userId = await dependencies.authenticate(request);
    const session = await dependencies.findSession(sessionId, userId);
    if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);

    const paths = [
      ...(session.videoPath ? [session.videoPath] : []),
      ...(session.analysisVideoPath ? [session.analysisVideoPath] : []),
      ...session.artifactPaths,
    ];
    if (paths.length > 0) await dependencies.removeVideos(paths);
    await dependencies.deleteSession(session.id, userId);
    return json({ deleted: true }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    }
    return json({ message: "Analysis could not be deleted", code: "DELETE_FAILED" }, 500);
  }
}
