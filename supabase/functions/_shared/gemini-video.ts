import { GEMINI_ANALYSIS_JSON_SCHEMA, type AnalysisCandidate, validateAnalysisCandidate } from "./analysis-contract.ts";

const API = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_API = "https://generativelanguage.googleapis.com/upload/v1beta/files";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type GeminiFile = {
  name: string;
  uri: string;
  mimeType: string;
  state: "PROCESSING" | "ACTIVE" | "FAILED";
};

export type VideoPreflightCheck = {
  outcome: "usable" | "unable";
  usableObservations: string[];
  limitations: string[];
  retryReason: string | null;
  retryInstruction: string | null;
};

const VIDEO_PREFLIGHT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["outcome", "usableObservations", "limitations", "retryReason", "retryInstruction"],
  properties: {
    outcome: { type: "string", enum: ["usable", "unable"] },
    usableObservations: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
    retryReason: { type: ["string", "null"] },
    retryInstruction: { type: ["string", "null"] },
  },
} as const;

const VIDEO_PREFLIGHT_PROMPT = `Check only whether this exercise recording is blatantly unusable before full analysis.
Return unable only when there is no person or exercise movement to evaluate, the view is overwhelmingly blocked or dark, the subject stays outside the frame, or the video is corrupted. If any meaningful exercise movement is visible, return usable even when the angle is imperfect or some joints leave frame briefly.
Do not identify the exercise and do not provide form coaching. For unable, provide one short specific retryReason and one actionable retryInstruction. For usable, set retryReason and retryInstruction to null.`;

type ClientOptions = {
  apiKey: string;
  model: string;
  fetcher?: Fetcher;
};

async function responseJson(response: Response, message: string): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`${message}: ${response.status}`);
  return payload;
}

function parseFile(value: unknown): GeminiFile {
  const file = (value && typeof value === "object" && "file" in value ? (value as { file: unknown }).file : value) as Record<string, unknown> | null;
  if (!file || typeof file.name !== "string" || typeof file.uri !== "string") throw new Error("Gemini returned invalid file metadata");
  const state = String(file.state ?? "PROCESSING").toUpperCase();
  if (state !== "PROCESSING" && state !== "ACTIVE" && state !== "FAILED") throw new Error("Gemini returned an unknown file state");
  return { name: file.name, uri: file.uri, mimeType: typeof file.mimeType === "string" ? file.mimeType : "video/mp4", state };
}

function responseText(payload: Record<string, unknown>): string {
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") throw new Error("Gemini returned no candidate");
  const content = (candidates[0] as Record<string, unknown>).content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) throw new Error("Gemini returned no content parts");
  const text = parts.map((part) => part && typeof part === "object" ? (part as Record<string, unknown>).text : null).find((value) => typeof value === "string");
  if (typeof text !== "string") throw new Error("Gemini returned no structured text");
  return text;
}

function parsePreflight(value: unknown): VideoPreflightCheck {
  if (!value || typeof value !== "object") throw new Error("Gemini returned an invalid video check");
  const check = value as Record<string, unknown>;
  if (check.outcome !== "usable" && check.outcome !== "unable") throw new Error("Gemini returned an invalid video-check outcome");
  if (!Array.isArray(check.usableObservations) || !check.usableObservations.every((item) => typeof item === "string")) throw new Error("Gemini returned invalid usable observations");
  if (!Array.isArray(check.limitations) || !check.limitations.every((item) => typeof item === "string")) throw new Error("Gemini returned invalid video limitations");
  const retryReason = typeof check.retryReason === "string" ? check.retryReason.trim() : null;
  const retryInstruction = typeof check.retryInstruction === "string" ? check.retryInstruction.trim() : null;
  if (check.outcome === "unable" && (!retryReason || !retryInstruction)) throw new Error("An unusable video check requires retry guidance");
  return {
    outcome: check.outcome,
    usableObservations: check.usableObservations,
    limitations: check.limitations,
    retryReason: check.outcome === "unable" ? retryReason : null,
    retryInstruction: check.outcome === "unable" ? retryInstruction : null,
  };
}

export function createGeminiVideoClient({ apiKey, model, fetcher = fetch }: ClientOptions) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  if (!model) throw new Error("GEMINI_MODEL is required");
  const key = encodeURIComponent(apiKey);

  return {
    async uploadVideo(input: { body: BodyInit; contentLength: number; mimeType: string; displayName: string }): Promise<GeminiFile> {
      const start = await fetcher(`${UPLOAD_API}?key=${key}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(input.contentLength),
          "X-Goog-Upload-Header-Content-Type": input.mimeType,
        },
        body: JSON.stringify({ file: { display_name: input.displayName } }),
      });
      if (!start.ok) throw new Error(`Gemini upload could not start: ${start.status}`);
      const uploadUrl = start.headers.get("x-goog-upload-url");
      if (!uploadUrl) throw new Error("Gemini upload URL is missing");

      const uploaded = await fetcher(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Length": String(input.contentLength),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
          "Content-Type": input.mimeType,
        },
        body: input.body,
      });
      return parseFile(await responseJson(uploaded, "Gemini upload failed"));
    },

    async getFile(name: string): Promise<GeminiFile> {
      const response = await fetcher(`${API}/${name}?key=${key}`);
      return parseFile(await responseJson(response, "Gemini file status failed"));
    },

    async checkVideo(input: { file: GeminiFile }): Promise<VideoPreflightCheck> {
      const response = await fetcher(`${API}/models/${encodeURIComponent(model)}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { fileData: { mimeType: input.file.mimeType, fileUri: input.file.uri }, videoMetadata: { fps: 2 } },
              { text: VIDEO_PREFLIGHT_PROMPT },
            ],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: VIDEO_PREFLIGHT_JSON_SCHEMA,
          },
        }),
      });
      const payload = await responseJson(response, "Gemini video check failed");
      return parsePreflight(JSON.parse(responseText(payload)));
    },

    async generateAnalysis(input: { file: GeminiFile; prompt: string; durationMs: number }): Promise<AnalysisCandidate> {
      let prompt = input.prompt;
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetcher(`${API}/models/${encodeURIComponent(model)}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { fileData: { mimeType: input.file.mimeType, fileUri: input.file.uri }, videoMetadata: { fps: 24 } },
                { text: prompt },
              ],
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: GEMINI_ANALYSIS_JSON_SCHEMA,
            },
          }),
        });
        const payload = await responseJson(response, "Gemini analysis failed");
        try {
          return validateAnalysisCandidate(JSON.parse(responseText(payload)), input.durationMs);
        } catch (error) {
          lastError = error;
          if (attempt === 0) {
            const message = error instanceof Error ? error.message : "unknown validation error";
            prompt = `${input.prompt}\n\nThe previous response failed validation: ${message}. Return one complete corrected JSON object.`;
          }
        }
      }
      throw lastError instanceof Error ? lastError : new Error("Gemini returned invalid analysis twice");
    },

    async deleteFile(name: string): Promise<void> {
      const response = await fetcher(`${API}/${name}?key=${key}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error(`Gemini file cleanup failed: ${response.status}`);
    },
  };
}
