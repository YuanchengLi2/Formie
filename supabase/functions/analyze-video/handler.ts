import type { GeminiFile } from "../_shared/gemini-files.ts";

export type AnalyzeVideoSession = {
  id: string;
  userId: string;
  status: string;
  stage: string | null;
  failureCode: string | null;
  videoPath: string | null;
  analysisVideoPath: string | null;
  analysisFallbackVideoPath: string | null;
  analysisInputVariant: "primary" | "privacy_safe_upper_body" | string | null;
  analysisInputStrategy: string | null;
  durationMs: number | null;
  geminiFileName: string | null;
  geminiFileUri: string | null;
  geminiFileState: GeminiFile["state"] | null;
  setDeclaration?: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type PipelineAdvanceResult = {
  status: string;
  stage: string;
  result?: Record<string, unknown>;
  frameRequests?: unknown[];
  retrying?: boolean;
  attempt?: number;
};

export type AnalyzeVideoDependencies = {
  authenticate: (request: Request) => Promise<string>;
  loadSession: (sessionId: string, userId: string) => Promise<AnalyzeVideoSession | null>;
  uploadFile: (session: AnalyzeVideoSession) => Promise<GeminiFile>;
  saveFile: (sessionId: string, file: GeminiFile) => Promise<void>;
  getFile: (name: string) => Promise<GeminiFile>;
  saveFileState: (sessionId: string, file: GeminiFile) => Promise<void>;
  advancePipeline: (session: AnalyzeVideoSession, file: GeminiFile) => Promise<PipelineAdvanceResult>;
  recordStageFailure: (sessionId: string, stage: string, code: string) => Promise<{ attempts: number; terminal: boolean }>;
  markFailed: (sessionId: string, code: string) => Promise<void>;
  deleteFile: (name: string) => Promise<void>;
  releaseStoredVideo: (session: AnalyzeVideoSession, phase: "source_uploaded" | "terminal") => Promise<void>;
  activateFallbackInput: (sessionId: string) => Promise<boolean>;
};

const terminalStatuses = new Set(["complete", "partial", "unable", "failed"]);

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function payload(session: AnalyzeVideoSession, state: PipelineAdvanceResult) {
  return {
    sessionId: session.id,
    status: state.status,
    stage: state.stage,
    failureCode: state.status === "failed" ? session.failureCode : null,
    durationMs: session.durationMs,
    videoUrl: null,
    setDeclaration: session.setDeclaration ?? null,
    result: state.result ?? null,
    frameRequests: state.frameRequests ?? [],
    ...(state.retrying ? { retrying: true, attempt: state.attempt ?? 1 } : {}),
  };
}

function stableFailureCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "");
    if (/^[A-Z][A-Z0-9_]{2,63}$/.test(code)) return code;
  }
  return "ANALYSIS_FAILED";
}

export async function analyzeVideoHandler(request: Request, dependencies: AnalyzeVideoDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  let sessionId: string | undefined;
  try {
    ({ sessionId } = await request.json() as { sessionId?: string });
  } catch {
    return json({ message: "A valid sessionId is required", code: "INVALID_BODY" }, 400);
  }
  if (!sessionId) return json({ message: "sessionId is required", code: "INVALID_BODY" }, 400);

  let session: AnalyzeVideoSession | null = null;
  try {
    const userId = await dependencies.authenticate(request);
    session = await dependencies.loadSession(sessionId, userId);
    if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    if (terminalStatuses.has(session.status)) {
      await dependencies.releaseStoredVideo(session, "terminal").catch(() => undefined);
      return json(payload(session, { status: session.status, stage: session.stage ?? session.status, ...(session.result ? { result: session.result } : {}) }), 200);
    }
    if ((!session.videoPath && !session.geminiFileName) || !session.durationMs) return json({ message: "The uploaded video is not ready", code: "VIDEO_NOT_FOUND" }, 409);

    if (!session.geminiFileName) {
      const uploaded = await dependencies.uploadFile(session);
      await dependencies.saveFile(session.id, uploaded);
      await dependencies.releaseStoredVideo(session, "source_uploaded");
      return json(payload(session, { status: "processing", stage: "video_processing" }), 202);
    }

    const file = await dependencies.getFile(session.geminiFileName);
    await dependencies.saveFileState(session.id, file);
    if (file.state === "PROCESSING") return json(payload(session, { status: "processing", stage: "video_processing" }), 202);
    if (file.state === "FAILED") {
      await dependencies.markFailed(session.id, "GEMINI_FILE_FAILED");
      await dependencies.releaseStoredVideo(session, "terminal").catch(() => undefined);
      return json({ message: "Gemini could not process the uploaded video", code: "GEMINI_FILE_FAILED" }, 502);
    }

    const advanced = await dependencies.advancePipeline(session, file);
    const complete = terminalStatuses.has(advanced.status);
    if (complete) {
      await dependencies.deleteFile(file.name).catch(() => undefined);
      await dependencies.releaseStoredVideo(session, "terminal").catch(() => undefined);
    }
    return json(payload(session, advanced), complete ? 200 : 202);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    if (session) {
      const stage = session.stage ?? "unknown";
      const code = stableFailureCode(error);
      if (code === "GEMINI_PROHIBITED_CONTENT") {
        const activated = await dependencies.activateFallbackInput(session.id).catch(() => false);
        if (activated) {
          if (session.geminiFileName) await dependencies.deleteFile(session.geminiFileName).catch(() => undefined);
          return json(payload(session, {
            status: "processing",
            stage: "video_processing",
            retrying: true,
            attempt: 1,
          }), 202);
        }
        await dependencies.markFailed(session.id, code).catch(() => undefined);
        await dependencies.releaseStoredVideo(session, "terminal").catch(() => undefined);
        return json({ message: "Analysis could not continue", code }, 500);
      }
      const failure = await dependencies.recordStageFailure(session.id, stage, code).catch(() => ({ attempts: 3, terminal: true }));
      if (!failure.terminal) {
        return json(payload(session, { status: "processing", stage, retrying: true, attempt: failure.attempts }), 202);
      }
      await dependencies.markFailed(session.id, code).catch(() => undefined);
      await dependencies.releaseStoredVideo(session, "terminal").catch(() => undefined);
      return json({ message: "Analysis could not continue", code }, 500);
    }
    return json({ message: "Analysis could not continue", code: "ANALYSIS_FAILED" }, 500);
  }
}
