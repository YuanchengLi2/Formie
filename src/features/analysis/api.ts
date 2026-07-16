import { z } from "zod";

import { analysisResultSchema, type AnalysisResult } from "./result-schema";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const createSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  upload: z.object({
    signedUrl: z.string().url(),
    token: z.string().min(1),
    path: z.string().min(1),
  }),
});

const statusResponseSchema = z.object({
  sessionId: z.string().min(1),
  status: z.enum(["created", "uploading", "queued", "processing", "complete", "partial", "unable", "failed"]),
  stage: z.string().min(1).nullable(),
  videoUrl: z.string().url().nullable().optional().default(null),
  result: analysisResultSchema.nullable(),
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

export type TutorialVideo = z.infer<typeof tutorialVideoSchema>;

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
  input: RequestContext & { previousSessionId?: string },
): Promise<CreateAnalysisSessionResponse> {
  return requestJson(
    "create-analysis",
    input,
    {
      method: "POST",
      body: JSON.stringify(input.previousSessionId ? { previousSessionId: input.previousSessionId } : {}),
    },
    createSessionResponseSchema,
  );
}

export async function uploadAnalysisVideo(input: {
  localUri: string;
  signedUrl: string;
  uploadToken: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
}): Promise<void> {
  const fetcher = input.fetcher ?? fetch;
  const localResponse = await fetcher(input.localUri, { signal: input.signal });
  if (!localResponse.ok) {
    throw new AnalysisApiError("Recorded video could not be read", localResponse.status, "VIDEO_READ_FAILED");
  }
  const body = await localResponse.arrayBuffer();
  const contentType = localResponse.headers.get("Content-Type") || "video/mp4";
  const uploadUrl = new URL(input.signedUrl);
  if (!uploadUrl.searchParams.has("token")) uploadUrl.searchParams.set("token", input.uploadToken);
  const uploadResponse = await fetcher(uploadUrl.toString(), {
    method: "PUT",
    body,
    signal: input.signal,
    headers: {
      "Content-Type": contentType,
      "x-upsert": "false",
    },
  });
  if (!uploadResponse.ok) {
    throw new AnalysisApiError("Video upload failed", uploadResponse.status, "UPLOAD_FAILED");
  }
}

export async function completeAnalysisUpload(input: RequestContext & {
  sessionId: string;
  durationMs: number;
  captureOrientation: "portraitUp" | "portraitDown" | "landscapeLeft" | "landscapeRight" | "unknown";
  cameraFacing: "front" | "back";
  cameraLens: string | null;
}): Promise<{ processing: true }> {
  return requestJson(
    "complete-upload",
    input,
    { method: "POST", body: JSON.stringify({ sessionId: input.sessionId, durationMs: input.durationMs, captureOrientation: input.captureOrientation, cameraFacing: input.cameraFacing, cameraLens: input.cameraLens }) },
    z.object({ processing: z.literal(true) }),
  );
}

export async function processAnalysis(input: RequestContext & { sessionId: string }): Promise<AnalysisStatusResponse> {
  return requestJson(
    "analyze-video",
    input,
    { method: "POST", body: JSON.stringify({ sessionId: input.sessionId }) },
    statusResponseSchema,
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
