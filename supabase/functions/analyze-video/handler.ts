import type { AnalysisCandidate } from "../_shared/analysis-contract.ts";
import type { GeminiFile, VideoPreflightCheck } from "../_shared/gemini-video.ts";

export type AnalyzeVideoSession = {
  id: string;
  userId: string;
  status: string;
  stage: string | null;
  videoPath: string | null;
  durationMs: number | null;
  requestedFps: 24;
  geminiFileName: string | null;
  geminiFileUri: string | null;
  geminiFileState: GeminiFile["state"] | null;
  preflightCheck: VideoPreflightCheck | null;
  result: AnalysisCandidate | null;
};

export type AnalyzeVideoDependencies = {
  authenticate: (request: Request) => Promise<string>;
  loadSession: (sessionId: string, userId: string) => Promise<AnalyzeVideoSession | null>;
  uploadFile: (session: AnalyzeVideoSession) => Promise<GeminiFile>;
  saveFile: (sessionId: string, file: GeminiFile) => Promise<void>;
  getFile: (name: string) => Promise<GeminiFile>;
  saveFileState: (sessionId: string, file: GeminiFile) => Promise<void>;
  checkVideo: (session: AnalyzeVideoSession, file: GeminiFile) => Promise<VideoPreflightCheck>;
  savePreflightCheck: (sessionId: string, check: VideoPreflightCheck) => Promise<void>;
  buildPrompt: (session: AnalyzeVideoSession) => Promise<string>;
  generate: (session: AnalyzeVideoSession, file: GeminiFile, prompt: string) => Promise<AnalysisCandidate>;
  verify: (session: AnalyzeVideoSession, file: GeminiFile, draft: AnalysisCandidate) => Promise<AnalysisCandidate>;
  markStage: (sessionId: string, stage: "video_processing" | "technique_review" | "coaching") => Promise<void>;
  saveResult: (sessionId: string, result: AnalysisCandidate) => Promise<void>;
  markFailed: (sessionId: string, code: string) => Promise<void>;
  deleteFile: (name: string) => Promise<void>;
};

const terminalStatuses = new Set(["complete", "partial", "unable", "failed"]);

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function statusPayload(session: AnalyzeVideoSession, status: string, stage: string | null, result: AnalysisCandidate | null) {
  return { sessionId: session.id, status, stage, durationMs: session.durationMs, videoUrl: null, result };
}

function unableResult(check: VideoPreflightCheck): AnalysisCandidate {
  return {
    status: "unable",
    recognition: {
      label: null,
      variation: null,
      equipment: [],
      confidence: 0,
      alternatives: [],
      catalogExerciseId: null,
      exerciseFamily: "other",
    },
    videoCheck: check,
    overallAssessment: null,
    score: null,
    scoreRationale: [],
    didWell: [],
    priorityCorrections: [],
    coachingCues: [],
    setSummary: { totalReps: null, consistentReps: null, verdict: null },
    repTimeline: [],
    nextSetPlan: [],
    precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
    precisionReview: { runsRequested: 0, runsUsed: 0, status: "not-needed", summary: null, passes: [] },
    comparison: null,
  };
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
      return json(statusPayload(session, session.status, session.stage, session.result), 200);
    }
    if (!session.videoPath || !session.durationMs) {
      return json({ message: "The uploaded video is not ready", code: "VIDEO_NOT_FOUND" }, 409);
    }

    if (!session.geminiFileName) {
      const file = await dependencies.uploadFile(session);
      await dependencies.saveFile(session.id, file);
      return json(statusPayload(session, "processing", "video_check", null), 202);
    }

    const [file, preparedPrompt] = session.preflightCheck
      ? await Promise.all([dependencies.getFile(session.geminiFileName), dependencies.buildPrompt(session)])
      : [await dependencies.getFile(session.geminiFileName), null];
    await dependencies.saveFileState(session.id, file);
    if (file.state === "PROCESSING") {
      return json(statusPayload(session, "processing", session.preflightCheck ? "video_processing" : "video_check", null), 202);
    }
    if (file.state === "FAILED") {
      await dependencies.markFailed(session.id, "GEMINI_FILE_FAILED");
      return json({ message: "Gemini could not process the uploaded video", code: "GEMINI_FILE_FAILED" }, 502);
    }

    if (!session.preflightCheck) {
      let check: VideoPreflightCheck;
      try {
        check = await dependencies.checkVideo(session, file);
      } catch {
        await dependencies.markFailed(session.id, "GEMINI_VIDEO_CHECK_FAILED");
        return json({ message: "The recording could not be checked", code: "GEMINI_VIDEO_CHECK_FAILED" }, 502);
      }
      if (check.outcome === "unable") {
        const result = unableResult(check);
        await dependencies.saveResult(session.id, result);
        await dependencies.deleteFile(file.name).catch(() => undefined);
        return json(statusPayload(session, "unable", "video_check", result), 200);
      }
      await dependencies.savePreflightCheck(session.id, check);
      await dependencies.markStage(session.id, "video_processing");
    }

    await dependencies.markStage(session.id, "technique_review");
    const prompt = preparedPrompt ?? await dependencies.buildPrompt(session);
    let result: AnalysisCandidate;
    try {
      result = await dependencies.generate(session, file, prompt);
    } catch {
      await dependencies.markFailed(session.id, "GEMINI_ANALYSIS_FAILED");
      return json({ message: "Gemini analysis could not be validated", code: "GEMINI_ANALYSIS_FAILED" }, 502);
    }

    await dependencies.markStage(session.id, "coaching");
    try {
      result = await dependencies.verify(session, file, result);
    } catch {
      result = {
        ...result,
        precisionRequest: { requestedRuns: 0, reason: null, targets: [] },
        precisionReview: {
          runsRequested: result.precisionRequest.requestedRuns,
          runsUsed: 0,
          status: "failed",
          summary: "The requested premium precision review was unavailable.",
          passes: [],
        },
        verification: {
          performed: true,
          reason: "Precision verification was unavailable; the primary analysis was retained.",
          outcome: "failed",
          checkedFindingId: result.priorityCorrections[0]?.id ?? null,
        },
      };
    }
    await dependencies.saveResult(session.id, result);
    await dependencies.deleteFile(file.name).catch(() => undefined);
    return json(statusPayload(session, result.status, "coaching", result), 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    if (session) await dependencies.markFailed(session.id, "ANALYSIS_FAILED").catch(() => undefined);
    return json({ message: "Analysis could not continue", code: "ANALYSIS_FAILED" }, 500);
  }
}
