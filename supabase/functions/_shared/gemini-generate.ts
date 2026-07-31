export type GeminiInputFile = { uri: string; mimeType: string };
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

type GenerateConfig = {
  thinkingConfig: { thinkingLevel: ThinkingLevel };
  responseMimeType: "application/json";
  responseJsonSchema: JsonSchema;
  mediaResolution?: MediaResolution;
  maxOutputTokens?: number;
  temperature?: number;
};

const GEMINI_VALIDATION_ONLY_SCHEMA_KEYS = new Set(["minimum", "maximum", "minItems", "maxItems"]);

function geminiResponseSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(geminiResponseSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !GEMINI_VALIDATION_ONLY_SCHEMA_KEYS.has(key))
      .map(([key, nested]) => [key, geminiResponseSchema(nested)]),
  );
}

export type VideoGenerateContentRequest = {
  contents: { role: "user"; parts: ({ fileData: { fileUri: string; mimeType: string }; videoMetadata?: { fps?: number; startOffset?: string; endOffset?: string } } | { text: string })[] }[];
  generationConfig: GenerateConfig;
};

export type TextGenerateContentRequest = {
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

function generationConfig(schema: JsonSchema, thinkingLevel: ThinkingLevel): GenerateConfig {
  return {
    thinkingConfig: { thinkingLevel },
    responseMimeType: "application/json",
    responseJsonSchema: geminiResponseSchema(schema) as JsonSchema,
  };
}

export function buildVideoGenerateContentRequest(input: { file: GeminiInputFile; prompt: string; schema: JsonSchema; fps: number | null; thinkingLevel: ThinkingLevel; mediaResolution: MediaResolution; window?: { startMs: number; endMs: number } | null; windows?: { startMs: number; endMs: number }[] }): VideoGenerateContentRequest {
  if (input.fps !== null && (!Number.isFinite(input.fps) || input.fps <= 0 || input.fps > 24)) throw new Error("fps must be between 0 and 24");
  if (input.window && input.windows) throw new Error("provide window or windows, not both");
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
    return input.fps === null && !window
      ? { fileData: { fileUri: input.file.uri, mimeType: input.file.mimeType } }
      : { fileData: { fileUri: input.file.uri, mimeType: input.file.mimeType }, videoMetadata };
  };
  const fileParts = windows.length > 0 ? windows.map(filePart) : [filePart()];
  return {
    contents: [{ role: "user", parts: [...fileParts, { text: input.prompt }] }],
    generationConfig: { ...generationConfig(input.schema, input.thinkingLevel), mediaResolution: input.mediaResolution },
  };
}

export function buildTextGenerateContentRequest(input: { prompt: string; schema: JsonSchema; thinkingLevel: ThinkingLevel }): TextGenerateContentRequest {
  return { contents: [{ role: "user", parts: [{ text: input.prompt }] }], generationConfig: generationConfig(input.schema, input.thinkingLevel) };
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
  if (
    input.temperature !== undefined
    && (
      !Number.isFinite(input.temperature)
      || input.temperature < 0
      || input.temperature > 2
    )
  ) {
    throw new Error("temperature must be between 0 and 2");
  }
  return {
    contents: [{
      role: "user",
      parts: [
        ...input.images.map((image) => ({ inlineData: image })),
        { text: input.prompt },
      ],
    }],
    generationConfig: {
      ...generationConfig(input.schema, input.thinkingLevel),
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
  return { value: JSON.parse(responseText(payload)) as unknown, usage: { promptTokens: token(usage.promptTokenCount), outputTokens: token(usage.candidatesTokenCount), thinkingTokens: token(usage.thoughtsTokenCount) } };
}

export function createGenerateContentClient(input: { apiKey: string; fetcher?: typeof fetch }) {
  if (!input.apiKey) throw new Error("GEMINI_API_KEY is required");
  const fetcher = input.fetcher ?? fetch;
  return {
    async generate(model: string, request: VideoGenerateContentRequest | TextGenerateContentRequest | ImageGenerateContentRequest) {
      if (!model) throw new Error("Gemini model is required");
      const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": input.apiKey }, body: JSON.stringify(request) });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        const error = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : null;
        throw new GeminiGenerateContentError(response.status, typeof error?.message === "string" ? error.message : undefined, error?.details);
      }
      return parseGenerateContentResponse(payload);
    },
  };
}
