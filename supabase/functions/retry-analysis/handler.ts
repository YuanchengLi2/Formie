export type RetryAnalysisSession = {
  id: string;
  userId: string;
  activeV49RunId?: string | null;
  pipelineVersion: string | null;
  analysisNextRetryAt?: string | null;
  hasUnreconciledStageFailure?: boolean;
};

const FIRST_NON_RETRYABLE_WHOLE_VIDEO_VERSION = 56;
const FIRST_LEASED_RETRYABLE_WHOLE_VIDEO_VERSION = 72;

export function canAutomaticallyRetry(session: RetryAnalysisSession, now = new Date()): boolean {
  const match = session.pipelineVersion?.match(/^gemini-whole-video-v(\d+)(?:-|$)/);
  if (!match) return true;
  const version = Number(match[1]);
  if (version < FIRST_NON_RETRYABLE_WHOLE_VIDEO_VERSION) return true;
  if (version < FIRST_LEASED_RETRYABLE_WHOLE_VIDEO_VERSION) return false;
  if (session.hasUnreconciledStageFailure) return true;
  const retryAt = session.analysisNextRetryAt ? Date.parse(session.analysisNextRetryAt) : NaN;
  return Number.isFinite(retryAt) && retryAt <= now.getTime();
}

export type RetryAnalysisDependencies = {
  primaryV49Enabled: boolean;
  authenticate: (request: Request) => Promise<void>;
  findDueSessions: (now: Date, limit: number) => Promise<RetryAnalysisSession[]>;
  eligibleForAi: (userId: string) => Promise<boolean>;
  invokeAnalysis: (session: RetryAnalysisSession) => Promise<number>;
  now?: () => Date;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function retryAnalysisHandler(
  request: Request,
  dependencies: RetryAnalysisDependencies,
): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  try {
    await dependencies.authenticate(request);
    const now = dependencies.now?.() ?? new Date();
    const candidates = (await dependencies.findDueSessions(now, 25))
      .filter((session) => canAutomaticallyRetry(session, now));
    const sessions: RetryAnalysisSession[] = [];
    for (const session of candidates) {
      if (await dependencies.eligibleForAi(session.userId)) sessions.push(session);
    }
    let succeeded = 0;
    let failed = 0;
    for (const session of sessions) {
      try {
        const status = await dependencies.invokeAnalysis(session);
        if (status >= 200 && status < 300) succeeded += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    return json({ processed: sessions.length, succeeded, failed }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return json({ message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }
    return json({ message: "Retry worker failed", code: "RETRY_WORKER_FAILED" }, 500);
  }
}
