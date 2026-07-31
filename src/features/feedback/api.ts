import { z } from "zod";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const feedbackCategorySchema = z.enum(["bug", "feature_request", "general"]);
export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;

export const feedbackDiagnosticsSchema = z.object({
  appVersion: z.string().min(1).max(50),
  build: z.string().min(1).max(50),
  platform: z.enum(["ios", "android", "web"]),
  osVersion: z.string().min(1).max(100),
}).strict();
export type FeedbackDiagnostics = z.infer<typeof feedbackDiagnosticsSchema>;

const responseSchema = z.object({
  submitted: z.literal(true),
  requestId: z.string().min(8).max(128),
}).strict();

export class FeedbackApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "REQUEST_FAILED",
  ) {
    super(message);
    this.name = "FeedbackApiError";
  }
}

function resolveBaseUrl(value?: string): string {
  const configured = value ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!configured) throw new FeedbackApiError("Supabase URL is not configured", 0, "MISSING_CONFIGURATION");
  return configured.endsWith("/functions/v1")
    ? configured
    : `${configured.replace(/\/$/, "")}/functions/v1`;
}

function resolveApiKey(value?: string): string {
  const configured = value ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!configured) throw new FeedbackApiError("Supabase public key is not configured", 0, "MISSING_CONFIGURATION");
  return configured;
}

export async function sendFeedback(input: {
  accessToken: string;
  clientRequestId: string;
  category: FeedbackCategory;
  message: string;
  diagnostics: FeedbackDiagnostics;
  apiKey?: string;
  baseUrl?: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
}): Promise<{ submitted: true; requestId: string }> {
  const fetcher = input.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(`${resolveBaseUrl(input.baseUrl)}/send-feedback`, {
      method: "POST",
      signal: input.signal,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        apikey: resolveApiKey(input.apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientRequestId: input.clientRequestId,
        category: feedbackCategorySchema.parse(input.category),
        message: input.message,
        diagnostics: feedbackDiagnosticsSchema.parse(input.diagnostics),
      }),
    });
  } catch (error) {
    if (error instanceof FeedbackApiError) throw error;
    throw new FeedbackApiError("Network request failed", 0, "NETWORK_ERROR");
  }

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new FeedbackApiError(
      typeof payload.message === "string" ? payload.message : "Feedback could not be sent. Try again.",
      response.status,
      typeof payload.code === "string" ? payload.code : "REQUEST_FAILED",
    );
  }
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new FeedbackApiError("Server returned an invalid response", response.status, "INVALID_RESPONSE");
  return parsed.data;
}
