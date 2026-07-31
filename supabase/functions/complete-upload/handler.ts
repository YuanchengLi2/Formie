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
    analysisInputStrategy: "video" | "trimmed_crop" | "upright_video";
    analysisVideoPath?: string | null;
    analysisFallbackVideoPath?: string | null;
    analysisDurationMs?: number | null;
    sourceStartMs?: number | null;
    sourceEndMs?: number | null;
    crop?: { x: number; y: number; width: number; height: number } | null;
    preprocessingConfidence?: number | null;
  }) => Promise<void>;
  wait: (milliseconds: number) => Promise<void>;
};

type AppliedPreprocessing = {
  applied: true;
  sourceStartMs: number;
  sourceEndMs: number;
  confidence: number;
  crop: { x: number; y: number; width: number; height: number };
};

function unit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function parsePreprocessing(value: unknown, durationMs: number): { applied: false } | AppliedPreprocessing | null {
  if (value === undefined) return { applied: false };
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.applied === false && Object.keys(record).length === 1) return { applied: false };
  if (record.applied !== true) return null;
  if (Object.keys(record).some((key) => !["applied", "sourceStartMs", "sourceEndMs", "confidence", "crop"].includes(key))) return null;
  const { sourceStartMs, sourceEndMs, confidence, crop } = record;
  if (
    !Number.isInteger(sourceStartMs) ||
    !Number.isInteger(sourceEndMs) ||
    typeof sourceStartMs !== "number" ||
    typeof sourceEndMs !== "number" ||
    sourceStartMs < 0 ||
    sourceEndMs > durationMs ||
    sourceEndMs <= sourceStartMs ||
    (sourceEndMs - sourceStartMs) / durationMs < 0.55 ||
    typeof confidence !== "number" ||
    confidence < 0.9 ||
    confidence > 1 ||
    !crop ||
    typeof crop !== "object" ||
    Array.isArray(crop)
  ) return null;
  const cropRecord = crop as Record<string, unknown>;
  if (Object.keys(cropRecord).some((key) => !["x", "y", "width", "height"].includes(key))) return null;
  const { x, y, width, height } = cropRecord;
  if (!unit(x) || !unit(y) || !unit(width) || !unit(height) || width < 0.8 || height < 0.8 || x + width > 1.000_001 || y + height > 1.000_001) return null;
  return { applied: true, sourceStartMs, sourceEndMs, confidence, crop: { x, y, width, height } };
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function uploadedVideoIsVisible(
  path: string,
  videoExists: (path: string) => Promise<boolean>,
  wait: (milliseconds: number) => Promise<void>,
): Promise<boolean> {
  for (const delayMs of [0, 150, 350, 750]) {
    if (delayMs > 0) await wait(delayMs);
    if (await videoExists(path)) return true;
  }
  return false;
}

export async function completeUploadHandler(request: Request, dependencies: CompleteUploadDependencies): Promise<Response> {
  if (request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ message: "A JSON request body is required", code: "INVALID_BODY" }, 400);
  }

  const keys = Object.keys(body);
  const { sessionId, durationMs } = body;
  if (
    keys.some((key) => key !== "sessionId" && key !== "durationMs" && key !== "preprocessing" && key !== "analysisInput" && key !== "privacySafeFallback") ||
    typeof sessionId !== "string" || !sessionId ||
    typeof durationMs !== "number" || !Number.isInteger(durationMs) || durationMs < 3_000 || durationMs > 15_000
  ) {
    return json({ message: "Invalid upload metadata", code: "INVALID_BODY" }, 400);
  }
  const preprocessing = parsePreprocessing(body.preprocessing, durationMs);
  if (!preprocessing) return json({ message: "Invalid preprocessing metadata", code: "INVALID_BODY" }, 400);
  const analysisInput = body.analysisInput;
  const uprightVideo = analysisInput !== undefined &&
    analysisInput !== null &&
    typeof analysisInput === "object" &&
    !Array.isArray(analysisInput) &&
    Object.keys(analysisInput).length === 2 &&
    (analysisInput as Record<string, unknown>).kind === "upright_video" &&
    (analysisInput as Record<string, unknown>).durationPreserved === true;
  if (analysisInput !== undefined && !uprightVideo) {
    return json({ message: "Invalid analysis input metadata", code: "INVALID_BODY" }, 400);
  }
  if (uprightVideo && body.preprocessing !== undefined) {
    return json({ message: "Analysis input cannot be both upright and trimmed", code: "INVALID_BODY" }, 400);
  }
  const fallback = body.privacySafeFallback;
  const privacySafeFallback = fallback !== undefined &&
    fallback !== null &&
    typeof fallback === "object" &&
    !Array.isArray(fallback) &&
    Object.keys(fallback).length === 2 &&
    (fallback as Record<string, unknown>).kind === "upper_body" &&
    (fallback as Record<string, unknown>).durationPreserved === true;
  if (fallback !== undefined && !privacySafeFallback) {
    return json({ message: "Invalid privacy-safe fallback metadata", code: "INVALID_BODY" }, 400);
  }
  if (privacySafeFallback && !uprightVideo) {
    return json({ message: "A privacy-safe fallback requires the upright analysis input", code: "INVALID_BODY" }, 400);
  }

  try {
    const userId = await dependencies.authenticate(request);
    const session = await dependencies.findSession(sessionId, userId);
    if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    const videoPath = session.videoPath ?? `${userId}/${sessionId}/original.mp4`;
    if (!(await uploadedVideoIsVisible(videoPath, dependencies.videoExists, dependencies.wait))) {
      return json({ message: "The uploaded video was not found", code: "VIDEO_NOT_FOUND" }, 409);
    }
    const analysisVideoPath = preprocessing.applied || uprightVideo ? `${userId}/${sessionId}/analysis-input.mp4` : null;
    if (analysisVideoPath && !(await uploadedVideoIsVisible(analysisVideoPath, dependencies.videoExists, dependencies.wait))) {
      return json({ message: "The cropped analysis video was not found", code: "VIDEO_NOT_FOUND" }, 409);
    }
    const analysisFallbackVideoPath = privacySafeFallback
      ? `${userId}/${sessionId}/privacy-safe-upper-body.mp4`
      : null;
    if (analysisFallbackVideoPath && !(await uploadedVideoIsVisible(analysisFallbackVideoPath, dependencies.videoExists, dependencies.wait))) {
      return json({ message: "The privacy-safe analysis video was not found", code: "VIDEO_NOT_FOUND" }, 409);
    }
    await dependencies.markProcessing({
      sessionId,
      userId,
      videoPath,
      durationMs,
      analysisInputStrategy: uprightVideo ? "upright_video" : preprocessing.applied ? "trimmed_crop" : "video",
      ...(uprightVideo ? {
        analysisVideoPath,
        analysisDurationMs: durationMs,
        sourceStartMs: 0,
        sourceEndMs: durationMs,
        crop: null,
        preprocessingConfidence: 1,
        ...(analysisFallbackVideoPath ? { analysisFallbackVideoPath } : {}),
      } : preprocessing.applied ? {
        analysisVideoPath,
        analysisDurationMs: preprocessing.sourceEndMs - preprocessing.sourceStartMs,
        sourceStartMs: preprocessing.sourceStartMs,
        sourceEndMs: preprocessing.sourceEndMs,
        crop: preprocessing.crop,
        preprocessingConfidence: preprocessing.confidence,
      } : {}),
    });
    return json({ processing: true }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    return json({ message: "Upload could not be completed", code: "COMPLETE_FAILED" }, 500);
  }
}
