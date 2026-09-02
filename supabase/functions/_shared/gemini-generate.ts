import { assertGenerallyAvailableGeminiModel, type GeminiGovernance } from "./gemini-governance.ts";

export type GeminiInputFile = { uri: string; mimeType: string };
export type GeminiInlineVideo = { kind: "inline"; data: string; mimeType: string };
export type GeminiVideoInput = GeminiInputFile | GeminiInlineVideo;
export type JsonSchema = Record<string, unknown>;
export type ThinkingLevel = "minimal" | "low" | "medium" | "high";
export type MediaResolution = "MEDIA_RESOLUTION_LOW" | "MEDIA_RESOLUTION_MEDIUM" | "MEDIA_RESOLUTION_HIGH";

export class GeminiGenerateContentError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message?: string, details?: unknown) {
    super(`Gemini generateContent failed${message ? `: ${message}` : ""}`);
    this.name = "GeminiGenerateContentError";
    this.status = status;
    this.code = `GEMINI_HTTP_${status}`;
    this.details = details;
  }
}

export class GeminiContentBlockedError extends Error {
  readonly code: string;
  readonly blockReason: string;

  constructor(blockReason: string) {
    super(`Gemini blocked the input: ${blockReason}`);
    this.name = "GeminiContentBlockedError";
    this.blockReason = blockReason;
    this.code = `GEMINI_${blockReason.replace(/[^A-Z0-9]+/gi, "_").toUpperCase()}`;
  }
}

export type GeminiUsage = { promptTokens: number; outputTokens: number; thinkingTokens: number };

export class GeminiStructuredResponseError extends Error {
  readonly code = "GEMINI_INVALID_STRUCTURED_RESPONSE";
  readonly usage: GeminiUsage;

  constructor(cause: unknown, usage: GeminiUsage) {
    super(cause instanceof Error ? cause.message : "Gemini returned invalid structured JSON");
    this.name = "GeminiStructuredResponseError";
    this.usage = usage;
    this.cause = cause;
  }
}

type GenerateConfig = {
  thinkingConfig: { thinkingLevel: ThinkingLevel };
  responseMimeType: "application/json";
  responseJsonSchema: JsonSchema;
  mediaResolution?: MediaResolution;
  maxOutputTokens?: number;
  temperature?: number;
};

const GEMINI_VALIDATION_ONLY_SCHEMA_KEYS = new Set(["minimum", "maximum", "minItems", "maxItems"]);
const GEMINI_SUPPORTED_SCHEMA_KEYS = new Set([
  "$id", "$defs", "$ref", "$anchor",
  "type", "format", "title", "description", "enum",
  "items", "prefixItems", "minItems", "maxItems", "minimum", "maximum",
  "anyOf", "oneOf", "properties", "additionalProperties", "required",
  "propertyOrdering",
]);

function geminiResponseSchema(value: unknown, preserveBounds: boolean, parentKey?: string): unknown {
  if (Array.isArray(value)) return value.map((item) => geminiResponseSchema(item, preserveBounds));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => (
        parentKey === "properties"
        || parentKey === "$defs"
        || (GEMINI_SUPPORTED_SCHEMA_KEYS.has(key) && (preserveBounds || !GEMINI_VALIDATION_ONLY_SCHEMA_KEYS.has(key)))
      ))
      .map(([key, nested]) => [key, geminiResponseSchema(nested, preserveBounds, key)]),
  );
}

export type VideoGenerateContentRequest = {
  contents: { role: "user"; parts: ({ fileData: { fileUri: string; mimeType: string } } | { inlineData: { data: string; mimeType: string } } | { videoMetadata: { fps?: number; startOffset?: string; endOffset?: string } } | { text: string })[] }[];
  generationConfig: GenerateConfig;
};

export type TextGenerateContentRequest = {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: "user"; parts: { text: string }[] }[];
  generationConfig: GenerateConfig;
};

export type ImageGenerateContentRequest = {
  contents: {
    role: "user";
    parts: (
      | { inlineData: { mimeType: "image/jpeg"; data: string } }
      | { text: string }
    )[];
  }[];
  generationConfig: GenerateConfig;
};

export type GenerateContentOptions = {
  /** Bounds a provider call so a failed model cannot hold an analysis session forever. */
  timeoutMs?: number;
};

function validateTemperature(value: number | undefined): void {
  if (
    value !== undefined
    && (!Number.isFinite(value) || value < 0 || value > 2)
  ) {
    throw new Error("temperature must be between 0 and 2");
  }
}

function generationConfig(schema: JsonSchema, thinkingLevel: ThinkingLevel, temperature?: number, preserveSchemaBounds = false): GenerateConfig {
  validateTemperature(temperature);
  return {
    thinkingConfig: { thinkingLevel },
    responseMimeType: "application/json",
    responseJsonSchema: geminiResponseSchema(schema, preserveSchemaBounds) as JsonSchema,
    ...(temperature === undefined ? {} : { temperature }),
  };
}

export function buildVideoGenerateContentRequest(input: { file?: GeminiInputFile; video?: GeminiVideoInput; prompt: string; schema: JsonSchema; fps: number | null; thinkingLevel: ThinkingLevel; mediaResolution: MediaResolution; temperature?: number; preserveSchemaBounds?: boolean; window?: { startMs: number; endMs: number } | null; windows?: { startMs: number; endMs: number }[] }): VideoGenerateContentRequest {
  const video = input.video ?? input.file;
  if (!video) throw new Error("video input is required");
  if (input.fps !== null && (!Number.isFinite(input.fps) || input.fps <= 0 || input.fps > 24)) throw new Error("fps must be between 0 and 24");
  if (input.window && input.windows) throw new Error("provide window or windows, not both");
  validateTemperature(input.temperature);
  const windows = input.windows ?? (input.window ? [input.window] : []);
  if (windows.length > 3) throw new Error("at most three video windows are allowed");
  windows.forEach((window) => {
    if (!Number.isFinite(window.startMs) || !Number.isFinite(window.endMs) || window.startMs < 0 || window.endMs <= window.startMs) {
      throw new Error("video window is invalid");
    }
  });
  const filePart = (window?: { startMs: number; endMs: number }) => {
    const videoMetadata = {
      ...(input.fps === null ? {} : { fps: input.fps }),
      ...(window ? { startOffset: `${window.startMs / 1_000}s`, endOffset: `${window.endMs / 1_000}s` } : {}),
    };
    const media = "kind" in video
      ? { inlineData: { data: video.data, mimeType: video.mimeType } }
      : { fileData: { fileUri: video.uri, mimeType: video.mimeType } };
    return input.fps === null && !window
      ? media
      : { ...media, videoMetadata };
  };
  const fileParts = windows.length > 0 ? windows.map(filePart) : [filePart()];
  return {
    contents: [{ role: "user", parts: [...fileParts, { text: input.prompt }] }],
    generationConfig: { ...generationConfig(input.schema, input.thinkingLevel, input.temperature, input.preserveSchemaBounds), mediaResolution: input.mediaResolution },
  };
}

export function buildTextGenerateContentRequest(input: { systemInstruction?: string; prompt: string; schema: JsonSchema; thinkingLevel: ThinkingLevel; preserveSchemaBounds?: boolean }): TextGenerateContentRequest {
  return {
    ...(input.systemInstruction ? { systemInstruction: { parts: [{ text: input.systemInstruction }] } } : {}),
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    generationConfig: generationConfig(input.schema, input.thinkingLevel, undefined, input.preserveSchemaBounds),
  };
}

export function buildImageGenerateContentRequest(input: {
  images: { mimeType: "image/jpeg"; data: string }[];
  prompt: string;
  schema: JsonSchema;
  thinkingLevel: ThinkingLevel;
  mediaResolution?: MediaResolution;
  maxOutputTokens?: number;
  temperature?: number;
}): ImageGenerateContentRequest {
  if (input.maxOutputTokens !== undefined && (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens <= 0)) {
    throw new Error("maxOutputTokens must be a positive integer");
  }
  validateTemperature(input.temperature);
  return {
    contents: [{
      role: "user",
      parts: [
        ...input.images.map((image) => ({ inlineData: image })),
        { text: input.prompt },
      ],
    }],
    generationConfig: {
      ...generationConfig(input.schema, input.thinkingLevel, input.temperature),
      ...(input.mediaResolution ? { mediaResolution: input.mediaResolution } : {}),
      ...(input.maxOutputTokens ? { maxOutputTokens: input.maxOutputTokens } : {}),
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    },
  };
}

function responseText(payload: Record<string, unknown>): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const candidate = candidates[0] && typeof candidates[0] === "object" ? candidates[0] as Record<string, unknown> : null;
  const content = candidate?.content && typeof candidate.content === "object" ? candidate.content as Record<string, unknown> : null;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const part = parts.find((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).text === "string") as Record<string, unknown> | undefined;
  if (!part) throw new Error("Gemini returned no structured text");
  return part.text as string;
}

function token(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function parseGenerateContentResponse(payload: Record<string, unknown>) {
  const promptFeedback = payload.promptFeedback && typeof payload.promptFeedback === "object"
    ? payload.promptFeedback as Record<string, unknown>
    : null;
  if (typeof promptFeedback?.blockReason === "string" && promptFeedback.blockReason) {
    throw new GeminiContentBlockedError(promptFeedback.blockReason);
  }
  const usage = payload.usageMetadata && typeof payload.usageMetadata === "object" ? payload.usageMetadata as Record<string, unknown> : {};
  const parsedUsage = { promptTokens: token(usage.promptTokenCount), outputTokens: token(usage.candidatesTokenCount), thinkingTokens: token(usage.thoughtsTokenCount) };
  try {
    return { value: JSON.parse(responseText(payload)) as unknown, usage: parsedUsage };
  } catch (error) {
    throw new GeminiStructuredResponseError(error, parsedUsage);
  }
}

export function createGenerateContentClient(input: { apiKey: string; governance: GeminiGovernance; fetcher?: typeof fetch }) {
  if (!input.apiKey) throw new Error("GEMINI_API_KEY is required");
  if (!input.governance) throw new Error("GEMINI_GOVERNANCE_REQUIRED");
  const fetcher = input.fetcher ?? fetch;
  return {
    async generate(model: string, request: VideoGenerateContentRequest | TextGenerateContentRequest | ImageGenerateContentRequest, options: GenerateContentOptions = {}) {
      if (!model) throw new Error("Gemini model is required");
      assertGenerallyAvailableGeminiModel(model);
      const timeoutMs = options.timeoutMs ?? 45_000;
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) throw new Error("Gemini timeout must be between one and 120 seconds");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": input.apiKey }, body: JSON.stringify(request), signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) throw new GeminiGenerateContentError(504, "request timed out");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        const error = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : null;
        throw new GeminiGenerateContentError(response.status, typeof error?.message === "string" ? error.message : undefined, error?.details);
      }
      return parseGenerateContentResponse(payload);
    },
  };
}
