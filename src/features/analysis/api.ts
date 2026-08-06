import { z } from "zod";
import { publishAccessMutation } from "@/features/access/access-events";
import { File } from "expo-file-system";

import { exerciseFamilies } from "@/features/exercises/exercise-family";
import { analysisResultSchema, type AnalysisResult } from "./result-schema";
import { setDeclarationSchema, type SetDeclaration } from "./set-declaration";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type UploadBody = BodyInit;

async function resolveNativeUploadFetcher(): Promise<Fetcher> {
  try {
    const module = await import("expo/fetch");
    return module.fetch as unknown as Fetcher;
  } catch {
    // Jest/web can use the standard fetch implementation; native Expo uses
    // expo/fetch, which understands File-system-backed File bodies.
    return fetch;
  }
}

const signedUploadSchema = z.object({
  signedUrl: z.string().url(),
  token: z.string().min(1),
  path: z.string().min(1),
});

const createSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  reservationId: z.string().min(1).optional(),
  remaining: z.number().int().nonnegative().nullable().optional(),
  periodEndsAt: z.string().min(1).nullable().optional(),
  upload: signedUploadSchema.optional(),
  analysisUpload: signedUploadSchema,
  privacySafeUpload: signedUploadSchema.optional(),
});

const statusResponseSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum(["created", "uploading", "queued", "processing", "complete", "partial", "unable", "failed"]),
  stage: z.string().min(1).nullable(),
  failureCode: z.string().min(1).nullable().optional().default(null),
  failureReason: z.string().min(1).nullable().optional().default(null),
  analysisNextRetryAt: z.string().nullable().optional(),
  durationMs: z.number().int().positive().nullable().optional().default(null),
  playbackWindow: z.object({
    sourceStartMs: z.number().int().nonnegative(),
    sourceEndMs: z.number().int().positive(),
  }).nullable().optional().default(null),
  videoUrl: z.string().url().nullable().optional().default(null),
  setDeclaration: setDeclarationSchema.nullable().optional(),
  result: analysisResultSchema.nullable(),
  retrying: z.boolean().optional(),
  attempt: z.number().int().positive().optional(),
});

const reanalysisResponseSchema = z.object({
  sessionId: z.string().min(1),
  status: z.literal("queued"),
  stage: z.literal("input_ready"),
  reservationId: z.string().min(1).optional(),
  remaining: z.number().int().nonnegative().nullable().optional(),
  periodEndsAt: z.string().min(1).nullable().optional(),
});

export const tutorialVideoSchema = z.object({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  url: z.string().url(),
  title: z.string().min(1),
  channel: z.string().min(1),
  whyChosen: z.string().min(1),
  thumbnailUrl: z.string().url(),
  searchAttributionHtml: z.string().min(1).nullable(),
});

export const recordingPreflightFrameSchema = z.object({
  timeMs: z.number().int().nonnegative(),
  mimeType: z.literal("image/jpeg"),
  data: z.string().min(1),
});

export const RECORDING_PREFLIGHT_FRAME_COUNT = 24;

const visibilityRequirementsSchema = z.object({
  source: z.enum(["catalog", "inferred"]),
  exerciseName: z.string().min(1).nullable(),
  bodyRegions: z.array(z.string().min(1)).min(1).max(8),
  equipment: z.array(z.string().min(1)).max(8),
  support: z.array(z.string().min(1)).max(8),
  movementPhases: z.array(z.string().min(1)).min(1).max(4),
});

const frameIndexArraySchema = z.array(
  z.number().int().min(0).max(RECORDING_PREFLIGHT_FRAME_COUNT - 1),
).max(RECORDING_PREFLIGHT_FRAME_COUNT);

const requirementEvidenceSchema = z.object({
  requirement: z.string().min(1),
  unusableFrameIndices: frameIndexArraySchema,
  perspectiveDistortedFrameIndices: frameIndexArraySchema,
});

const recordingPreflightChecksSchema = z.object({
  activityType: z.enum(["dynamic_reps", "static_hold", "unclear"]),
  visibility: z.enum(["sufficient", "limited", "insufficient"]),
  cameraQuality: z.enum(["sufficient", "limited", "insufficient"]),
  cameraLimitations: z.array(z.enum([
    "perspective_distortion",
    "distance",
    "framing",
    "lighting",
    "blur",
    "obstruction",
    "instability",
    "other",
  ])).max(8),
  movementEvidence: z.enum(["usable_reps", "usable_hold", "insufficient"]),
  visibilityRequirements: visibilityRequirementsSchema,
  missingRequirements: z.array(z.string().min(1)).max(28),
  perspectiveDistortedRequirements: z.array(z.string().min(1)).max(12),
  activeMovementFrameIndices: frameIndexArraySchema,
  requirementEvidence: z.array(requirementEvidenceSchema).max(28),
}).superRefine((checks, context) => {
  const uniqueLimitations = new Set(checks.cameraLimitations);
  if (
    uniqueLimitations.size !== checks.cameraLimitations.length
    || (checks.cameraQuality === "sufficient" && checks.cameraLimitations.length !== 0)
    || (checks.cameraQuality !== "sufficient" && checks.cameraLimitations.length === 0)
  ) {
    context.addIssue({ code: "custom", message: "Recording camera limitations are inconsistent" });
  }
  const allowedRequirements = new Set([
    ...checks.visibilityRequirements.bodyRegions,
    ...checks.visibilityRequirements.movementPhases,
  ]);
  const uniqueActiveFrames = new Set(checks.activeMovementFrameIndices);
  if (uniqueActiveFrames.size !== checks.activeMovementFrameIndices.length) {
    context.addIssue({ code: "custom", message: "Active movement frame evidence is inconsistent" });
  }
  const evidenceRequirements = new Set<string>();
  const derivedMissingRequirements: string[] = [];
  const derivedPerspectiveDistortedRequirements: string[] = [];
  for (const evidence of checks.requirementEvidence) {
    const unusableFrames = new Set(evidence.unusableFrameIndices);
    const perspectiveDistortedFrames = new Set(evidence.perspectiveDistortedFrameIndices);
    if (
      unusableFrames.size !== evidence.unusableFrameIndices.length
      || perspectiveDistortedFrames.size !== evidence.perspectiveDistortedFrameIndices.length
      || !allowedRequirements.has(evidence.requirement)
      || evidenceRequirements.has(evidence.requirement)
      || evidence.unusableFrameIndices.some((frameIndex) => !uniqueActiveFrames.has(frameIndex))
      || evidence.perspectiveDistortedFrameIndices.some((frameIndex) =>
        !uniqueActiveFrames.has(frameIndex)
      )
    ) {
      context.addIssue({ code: "custom", message: "Requirement frame evidence is inconsistent" });
      continue;
    }
    evidenceRequirements.add(evidence.requirement);
    if (
      checks.activeMovementFrameIndices.length > 0
      && unusableFrames.size >= checks.activeMovementFrameIndices.length / 2
    ) {
      derivedMissingRequirements.push(evidence.requirement);
    }
    if (
      checks.activeMovementFrameIndices.length > 0
      && perspectiveDistortedFrames.size >= checks.activeMovementFrameIndices.length / 2
    ) {
      derivedPerspectiveDistortedRequirements.push(evidence.requirement);
    }
  }
  if (
    new Set(checks.missingRequirements).size !== checks.missingRequirements.length
    || checks.missingRequirements.some((requirement) => !allowedRequirements.has(requirement))
    || evidenceRequirements.size !== allowedRequirements.size
    || [...allowedRequirements].some((requirement) => !evidenceRequirements.has(requirement))
    || derivedMissingRequirements.length !== checks.missingRequirements.length
    || derivedMissingRequirements.some((requirement) => !checks.missingRequirements.includes(requirement))
    || new Set(checks.perspectiveDistortedRequirements).size !== checks.perspectiveDistortedRequirements.length
    || checks.perspectiveDistortedRequirements.some((requirement) => !allowedRequirements.has(requirement))
    || derivedPerspectiveDistortedRequirements.length !== checks.perspectiveDistortedRequirements.length
    || derivedPerspectiveDistortedRequirements.some((requirement) =>
      !checks.perspectiveDistortedRequirements.includes(requirement)
    )
    || (checks.missingRequirements.length > 0 && checks.visibility !== "insufficient")
    || (checks.missingRequirements.length === 0 && checks.visibility === "insufficient")
    || (
      checks.perspectiveDistortedRequirements.length > 0
      && checks.cameraQuality !== "insufficient"
    )
    || (
      checks.perspectiveDistortedRequirements.length === 0
      && checks.cameraQuality === "insufficient"
    )
  ) {
    context.addIssue({ code: "custom", message: "Recording visibility requirements are inconsistent" });
  }
});

const recordingPreflightGuidanceSchema = z.object({
  phoneSetup: z.string().min(1),
  positioning: z.string().min(1),
  visibilityTarget: z.string().min(1),
});

export const recordingPreflightResultSchema = z.object({
  outcome: z.literal("usable"),
  reason: z.string().min(1).nullable(),
  checks: recordingPreflightChecksSchema,
  guidance: recordingPreflightGuidanceSchema.nullable(),
});

export const exerciseGuideSchema = z.object({
  exercise: z.object({
    catalogExerciseId: z.number().int().positive().nullable(),
    canonicalName: z.string().min(1),
    family: z.enum(exerciseFamilies),
  }),
  setup: z.array(z.string().min(1)).min(1).max(6),
  execution: z.array(z.string().min(1)).min(1).max(8),
  safety: z.array(z.string().min(1)).min(1).max(6),
  cameraPlacement: z.array(z.string().min(1)).min(1).max(4),
  tutorial: tutorialVideoSchema.nullable(),
});

export type ExerciseGuide = z.infer<typeof exerciseGuideSchema>;
export type TutorialVideo = z.infer<typeof tutorialVideoSchema>;
export type RecordingPreflightFrame = z.infer<typeof recordingPreflightFrameSchema>;
export type RecordingPreflightResult = z.infer<typeof recordingPreflightResultSchema>;
export type CreateAnalysisSessionResponse = z.infer<typeof createSessionResponseSchema>;
export type AnalysisStatusResponse = z.infer<typeof statusResponseSchema>;

export class AnalysisApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "AnalysisApiError";
  }
}

type RequestContext = {
  accessToken: string;
  baseUrl?: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
};

function resolveBaseUrl(baseUrl?: string): string {
  const configured = baseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!configured) {
    throw new AnalysisApiError("Supabase URL is not configured", 0, "MISSING_CONFIGURATION");
  }
  return configured.endsWith("/functions/v1") ? configured : `${configured.replace(/\/$/, "")}/functions/v1`;
}

async function requestJson<T>(
  path: string,
  context: RequestContext,
  init: Omit<RequestInit, "headers" | "signal"> & { body?: string },
  schema: z.ZodType<T>,
): Promise<T> {
  const fetcher = context.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher(`${resolveBaseUrl(context.baseUrl)}/${path}`, {
      ...init,
      signal: context.signal,
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof AnalysisApiError) {
      throw error;
    }
    throw new AnalysisApiError("Network request failed", 0, "NETWORK_ERROR");
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new AnalysisApiError(
      typeof payload.message === "string" ? payload.message : "Request failed",
      response.status,
      typeof payload.code === "string" ? payload.code : "REQUEST_FAILED",
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new AnalysisApiError("Server returned an invalid response", response.status, "INVALID_RESPONSE");
  }
  return parsed.data;
}

export async function createAnalysisSession(
  input: RequestContext & { previousSessionId?: string; clientRequestId?: string; declaration: SetDeclaration; privacySafeFallback?: boolean; uploadProfile?: "single_analysis_v1" },
): Promise<CreateAnalysisSessionResponse> {
  const declaration = setDeclarationSchema.parse(input.declaration);
  return requestJson(
    "create-analysis",
    input,
    {
      method: "POST",
      body: JSON.stringify({
        ...(input.previousSessionId ? { previousSessionId: input.previousSessionId } : {}),
        ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
        declaration,
        ...(input.uploadProfile ? { uploadProfile: input.uploadProfile } : {}),
        ...(input.privacySafeFallback !== undefined ? { privacySafeFallback: input.privacySafeFallback } : {}),
      }),
    },
    createSessionResponseSchema,
  );
}

export async function uploadAnalysisVideo(input: {
  localUri: string;
  signedUrl: string;
  uploadToken: string;
  upsert?: boolean;
  /** Test/native adapter escape hatch; production callers leave this unset. */
  body?: UploadBody;
  fetcher?: Fetcher;
  signal?: AbortSignal;
}): Promise<void> {
  return uploadSignedAnalysisArtifact(input);
}

export async function checkRecordingPreflight(
  input: RequestContext & {
    frames: RecordingPreflightFrame[];
    durationMs: number;
    exerciseName?: string | null;
    catalogExerciseId?: number | null;
  },
): Promise<RecordingPreflightResult> {
  const frames = z.array(recordingPreflightFrameSchema)
    .length(RECORDING_PREFLIGHT_FRAME_COUNT)
    .parse(input.frames);
  const durationMs = z.number().int().min(3_000).max(15_000).parse(input.durationMs);
  const exerciseName = z.string().trim().min(2).max(120).nullable().parse(input.exerciseName ?? null);
  const catalogExerciseId = z.number().int().positive().nullable().parse(input.catalogExerciseId ?? null);
  return requestJson(
    "recording-preflight",
    input,
    { method: "POST", body: JSON.stringify({ frames, durationMs, exerciseName, catalogExerciseId }) },
    recordingPreflightResultSchema,
  );
}

export async function uploadSignedAnalysisArtifact(input: {
  localUri: string;
  signedUrl: string;
  uploadToken: string;
  upsert?: boolean;
  mimeType?: string;
  /** Test/native adapter escape hatch; production callers leave this unset. */
  body?: UploadBody;
  fetcher?: Fetcher;
  signal?: AbortSignal;
}): Promise<void> {
  const fetcher = input.fetcher ?? await resolveNativeUploadFetcher();
  let body: UploadBody;
  if (input.body !== undefined) {
    body = input.body;
  } else {
    const file = new File(input.localUri);
    if (!file.exists) throw new AnalysisApiError("Recorded video could not be read", 0, "VIDEO_READ_FAILED");
    body = file;
  }
  const contentType = input.mimeType || "video/mp4";
  const uploadUrl = new URL(input.signedUrl);
  if (!uploadUrl.searchParams.has("token")) uploadUrl.searchParams.set("token", input.uploadToken);
  const uploadResponse = await fetcher(uploadUrl.toString(), {
    method: "PUT",
    body,
    signal: input.signal,
    headers: {
      "Content-Type": contentType,
      "x-upsert": input.upsert ? "true" : "false",
    },
  });
  if (!uploadResponse.ok) {
    throw new AnalysisApiError("Video upload failed", uploadResponse.status, "UPLOAD_FAILED");
  }
}

export async function completeAnalysisUpload(input: RequestContext & {
  sessionId: string;
  durationMs: number;
  analysisInput?:
    | { kind: "upright_video"; durationPreserved: true }
    | { kind: "capture_ready_video"; durationPreserved: true; byteLength: number };
  privacySafeFallback?: { kind: "upper_body"; durationPreserved: true };
}): Promise<{ processing: true }> {
  return requestJson(
    "complete-upload",
    input,
    {
      method: "POST",
      body: JSON.stringify({
        sessionId: input.sessionId,
        durationMs: input.durationMs,
        ...(input.analysisInput ? { analysisInput: input.analysisInput } : {}),
        ...(input.privacySafeFallback ? { privacySafeFallback: input.privacySafeFallback } : {}),
      }),
    },
    z.object({ processing: z.literal(true) }),
  );
}

export async function processAnalysis(input: RequestContext & { sessionId: string; retryDelayMs?: number }): Promise<AnalysisStatusResponse> {
  const transientStatuses = new Set([429, 500, 502, 503, 504, 546]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await requestJson(
        "analyze-video",
        input,
        { method: "POST", body: JSON.stringify({ sessionId: input.sessionId }) },
        statusResponseSchema,
      );
    } catch (error) {
      if (!(error instanceof AnalysisApiError) || !transientStatuses.has(error.status) || attempt === 2 || input.signal?.aborted) throw error;
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(timeout);
          input.signal?.removeEventListener("abort", onAbort);
          reject(new AnalysisApiError("Network request cancelled", 0, "ABORTED"));
        };
        const timeout = setTimeout(() => {
          input.signal?.removeEventListener("abort", onAbort);
          resolve();
        }, (input.retryDelayMs ?? 500) * (attempt + 1));
        input.signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
  }
  throw new AnalysisApiError("Analysis retry exhausted", 546, "WORKER_RESOURCE_LIMIT");
}

export async function reanalyzeAnalysis(input: RequestContext & { sessionId: string; declaration?: SetDeclaration; clientRequestId?: string }) {
  const result = await requestJson(
    "reanalyze-video",
    input,
    { method: "POST", body: JSON.stringify({
      sessionId: input.sessionId,
      ...(input.clientRequestId ? { clientRequestId: input.clientRequestId } : {}),
      ...(input.declaration ? { declaration: input.declaration } : {}),
    }) },
    reanalysisResponseSchema,
  );
  publishAccessMutation({ remaining: result.remaining ?? null, periodEndsAt: result.periodEndsAt ?? null });
  return result;
}

export async function getExerciseGuide(
  input: RequestContext & (
    | { catalogExerciseId: number; customExerciseName?: never }
    | { customExerciseName: string; catalogExerciseId?: never }
  ),
): Promise<ExerciseGuide> {
  const body = typeof input.customExerciseName === "string"
    ? { customExerciseName: input.customExerciseName.trim() }
    : { catalogExerciseId: input.catalogExerciseId };
  return requestJson(
    "exercise-guide",
    input,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    exerciseGuideSchema,
  );
}

export async function getExerciseTutorial(input: RequestContext & { sessionId: string }): Promise<TutorialVideo | null> {
  const response = await requestJson(
    "exercise-tutorial",
    input,
    { method: "POST", body: JSON.stringify({ sessionId: input.sessionId }) },
    z.object({ tutorial: tutorialVideoSchema.nullable() }),
  );
  return response.tutorial;
}

export async function getAnalysisStatus(input: RequestContext & { sessionId: string }): Promise<AnalysisStatusResponse> {
  return requestJson(
    `analysis-status?sessionId=${encodeURIComponent(input.sessionId)}`,
    input,
    { method: "GET" },
    statusResponseSchema,
  );
}

export async function processAndLoadAnalysis(input: RequestContext & { sessionId: string; includeVideoUrl?: boolean }): Promise<AnalysisStatusResponse> {
  const processed = await processAnalysis(input);
  return processed.result && input.includeVideoUrl ? getAnalysisStatus(input) : processed;
}

export function getCompletedResult(response: AnalysisStatusResponse): AnalysisResult | null {
  return response.result;
}
