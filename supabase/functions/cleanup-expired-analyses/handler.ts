export type RetentionCandidate = {
  id: string;
  userId: string;
  videoPath: string | null;
  analysisVideoPath: string | null;
  artifactPaths: string[];
  geminiFileName: string | null;
};

export type RetentionPolicyInput = {
  createdAt: string;
  videoRetentionDays: 30 | null;
  retentionEffectiveAt: string | null;
};

export type CleanupExpiredAnalysesDependencies = {
  authenticate: (request: Request) => Promise<void>;
  findEligible: (now: Date) => Promise<RetentionCandidate[]>;
  removeStorage: (paths: string[]) => Promise<void>;
  deleteGeminiFile: (fileName: string, userId: string) => Promise<"complete" | "queued">;
  deleteSession: (sessionId: string) => Promise<void>;
};

export function isRetentionEligible(input: RetentionPolicyInput, now: Date): boolean {
  if (input.videoRetentionDays !== 30 || !input.retentionEffectiveAt) return false;
  const createdAt = Date.parse(input.createdAt);
  const effectiveAt = Date.parse(input.retentionEffectiveAt);
  if (!Number.isFinite(createdAt) || !Number.isFinite(effectiveAt) || createdAt < effectiveAt) return false;
  return createdAt <= now.getTime() - 30 * 24 * 60 * 60 * 1_000;
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function cleanupExpiredAnalysesHandler(
  request: Request,
  dependencies: CleanupExpiredAnalysesDependencies,
  now = new Date(),
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  }
  try {
    await dependencies.authenticate(request);
    const candidates = await dependencies.findEligible(now);
    let deleted = 0;
    let externalCleanupQueued = 0;
    for (const candidate of candidates) {
      if (candidate.geminiFileName && await dependencies.deleteGeminiFile(candidate.geminiFileName, candidate.userId) === "queued") externalCleanupQueued += 1;
      const paths = [...new Set([
        ...(candidate.videoPath ? [candidate.videoPath] : []),
        ...(candidate.analysisVideoPath ? [candidate.analysisVideoPath] : []),
        ...candidate.artifactPaths,
      ])];
      if (paths.length > 0) await dependencies.removeStorage(paths);
      await dependencies.deleteSession(candidate.id);
      deleted += 1;
    }
    return json({ deleted, externalCleanupQueued }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return json({ message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }
    return json({ message: "Retention cleanup failed", code: "CLEANUP_FAILED" }, 500);
  }
}
