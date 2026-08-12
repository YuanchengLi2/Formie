export type RetryAnalysisSession = {
  id: string;
  userId: string;
  pipelineVersion: string | null;
  activeV49RunId?: string | null;
};

export function canAutomaticallyRetry(session: RetryAnalysisSession): boolean {
  return Boolean(session.id && session.userId);
}

export type RetryAnalysisDependencies = {
  primaryV49Enabled: boolean;
  authenticate: (request: Request) => Promise<void>;
  findDueSessions: (now: Date, limit: number) => Promise<RetryAnalysisSession[]>;
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
    const sessions = (await dependencies.findDueSessions(dependencies.now?.() ?? new Date(), 25))
      .filter(canAutomaticallyRetry);
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
