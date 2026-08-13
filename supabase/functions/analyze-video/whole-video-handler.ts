import { MAX_ANALYSIS_VIDEO_DURATION_MS } from "../_shared/analysis-settings.ts";
import { classifyAnalysisFailure, type AnalysisFailureDisposition } from "./failure-disposition.ts";

export type WholeVideoSession = {
  id: string;
  userId: string;
  status: string;
  stage: string | null;
  failureCode: string | null;
  videoPath: string | null;
  analysisVideoPath: string | null;
  durationMs: number | null;
  analysisNextRetryAt: string | null;
  result: Record<string, unknown> | null;
  analysisRetryCount?: number;
  hasStoredVideoEvidence?: boolean;
  [key: string]: unknown;
};

export type WholeVideoPipelineResult = {
  status: string;
  stage: string;
  result?: Record<string, unknown>;
  analysisNextRetryAt?: string | null;
};

export type WholeVideoHandlerDependencies = {
  authenticate: (request: Request) => Promise<string>;
  loadSession: (sessionId: string, userId: string) => Promise<WholeVideoSession | null>;
  advancePipeline: (session: WholeVideoSession) => Promise<WholeVideoPipelineResult>;
  markFailed: (sessionId: string, code: string) => Promise<WholeVideoPipelineResult>;
  markRetryable?: (session: WholeVideoSession, code: string) => Promise<WholeVideoPipelineResult>;
  now?: () => Date;
};

const terminalStatuses = new Set(["complete", "partial", "unable", "failed"]);

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function failureCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "");
    if (/^[A-Z][A-Z0-9_]{2,63}$/.test(code)) return code;
  }
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const detail = message
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 44);
  return detail ? `ANALYSIS_ERROR_${detail}`.slice(0, 64) : "ANALYSIS_FAILED";
}

function isRetryableFailure(code: string): boolean {
  return code === "ANALYSIS_FILE_PROCESSING"
    || /^GEMINI_HTTP_(?:400|408|409|425|429|5\d\d)$/.test(code)
    || /^ANALYSIS_CONTRACT_/.test(code)
    || /^ANALYSIS_(?:STATE|RESULT)_SAVE_FAILED/.test(code)
    || code === "ANALYSIS_DEADLINE_EXCEEDED"
    || code === "WRITER_DEADLINE_EXHAUSTED"
    || code === "ANALYSIS_VIDEO_DOWNLOAD_FAILED"
    || code === "ANALYSIS_FILE_METADATA_FAILED";
}

function payload(session: WholeVideoSession, state: WholeVideoPipelineResult) {
  return {
    sessionId: session.id,
    status: state.status,
    stage: state.stage,
    failureCode: state.status === "failed" ? session.failureCode : null,
    analysisNextRetryAt: state.analysisNextRetryAt ?? session.analysisNextRetryAt ?? null,
    durationMs: session.durationMs,
    videoUrl: null,
    setDeclaration: session.setDeclaration ?? null,
    result: state.result ?? null,
  };
}

export async function analyzeWholeVideoHandler(request: Request, dependencies: WholeVideoHandlerDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  let sessionId: string | undefined;
  try {
    ({ sessionId } = await request.json() as { sessionId?: string });
  } catch {
    return json({ message: "A valid sessionId is required", code: "INVALID_BODY" }, 400);
  }
  if (!sessionId) return json({ message: "sessionId is required", code: "INVALID_BODY" }, 400);

  let session: WholeVideoSession | null = null;
  try {
    const userId = await dependencies.authenticate(request);
    session = await dependencies.loadSession(sessionId, userId);
    if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    if (terminalStatuses.has(session.status)) {
      return json(payload(session, { status: session.status, stage: session.stage ?? session.status, ...(session.result ? { result: session.result } : {}) }), 200);
    }
    const retryAt = session.analysisNextRetryAt ? Date.parse(session.analysisNextRetryAt) : NaN;
    const now = dependencies.now?.() ?? new Date();
    if (Number.isFinite(retryAt) && retryAt > now.getTime()) {
      return json(payload(session, { status: "processing", stage: "retry_wait" }), 202);
    }
    if (session.durationMs !== null && session.durationMs > MAX_ANALYSIS_VIDEO_DURATION_MS) {
      return json({ message: "Video inputs are limited to 15 seconds", code: "VIDEO_TOO_LONG" }, 409);
    }
    if ((!session.analysisVideoPath && !session.videoPath) || !session.durationMs) {
      return json({ message: "The uploaded video is not ready", code: "VIDEO_NOT_FOUND" }, 409);
    }
    const advanced = await dependencies.advancePipeline(session);
    return json(payload(session, advanced), terminalStatuses.has(advanced.status) ? 200 : 202);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    const code = failureCode(error);
    if (code === "ANALYSIS_STAGE_BUSY") {
      return json(payload(session ?? { id: sessionId, status: "processing", stage: "analyzing", durationMs: null, result: null } as WholeVideoSession, {
        status: "processing",
        stage: session?.stage ?? "analyzing",
      }), 202);
    }
    if (isRetryableFailure(code) && session && dependencies.markRetryable) {
      const retryState = await dependencies.markRetryable(session, code);
      return json(payload(session, retryState), 202);
    }
    if (session) {
      try {
        const disposition = classifyAnalysisFailure({
          code,
          providerStatus: stringErrorProperty(error, "providerStatus"),
          httpStatus: numericErrorProperty(error, "httpStatus") ?? numericErrorProperty(error, "status"),
          completedStage: session.stage === "finalizing" ? "analyzing" : null,
          hasStoredVideoEvidence: Boolean(session.hasStoredVideoEvidence),
          retryCount: session.analysisRetryCount ?? 0,
          maxRetries: 3,
        });
        const failedState = await dependencies.persistFailure(session.id, code, disposition);
        const failedSession = {
          ...session,
          status: failedState.status,
          stage: failedState.stage,
          failureCode: failedState.status === "failed" ? code : null,
          analysisNextRetryAt: null,
          result: failedState.result ?? null,
        };
        return json(payload(failedSession, failedState), terminalStatuses.has(failedState.status) ? 200 : 202);
      } catch (markError) {
        console.error(JSON.stringify({
          sessionId: session.id,
          code: "ANALYSIS_RETRY_STATE_SAVE_FAILED",
          message: markError instanceof Error ? markError.message : String(markError),
        }));
      }
    }
    const failedSession = session
      ? { ...session, status: "failed", stage: "failed", failureCode: code, analysisNextRetryAt: null, result: null }
      : { id: sessionId, status: "failed", stage: "failed", failureCode: code, analysisNextRetryAt: null, durationMs: null, result: null } as WholeVideoSession;
    return json(payload(failedSession, { status: "failed", stage: "failed" }), 200);
  }
}
