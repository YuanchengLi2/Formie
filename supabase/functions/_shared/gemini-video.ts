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

const VIDEO_PREFLIGHT_PROMPT = `Check only whether this media is blatantly unusable before full exercise analysis.
Return unable only when the file is blank or corrupted, no person appears, or there is no meaningful human movement at all. Return usable whenever a person attempts any exercise-like movement. Bad form, an unusual variation, or low recognition confidence are never reasons to reject the recording. Do not judge technique, identify the exercise, or discuss recording direction or device placement.
For unable, provide one short factual retryReason and one actionable retryInstruction. For usable, set retryReason and retryInstruction to null.`;

const VERIFICATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["outcome", "reason", "finding"],
  properties: {
    outcome: { type: "string", enum: ["confirmed", "revised", "rejected"] },
    reason: { type: "string" },
    finding: {
      anyOf: [
        { type: "null" },
        GEMINI_ANALYSIS_JSON_SCHEMA.properties.priorityCorrections.items,
      ],
    },
  },
} as const;

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

const fallbackFamilyLabels: Record<string, string> = {
  curl: "Curl exercise",
  triceps: "Triceps extension",
  press: "Press exercise",
  "overhead-press": "Overhead press",
  fly: "Fly exercise",
  raise: "Raise exercise",
  row: "Row exercise",
  "pull-down": "Vertical pull exercise",
  squat: "Squat exercise",
  lunge: "Lunge exercise",
  hinge: "Hip hinge exercise",
  "hip-thrust": "Hip thrust",
  carry: "Loaded carry",
  core: "Core exercise",
  plank: "Plank exercise",
};

function pinUsableRecognition(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const result = value as Record<string, unknown>;
  if (result.status === "unable" || !result.recognition || typeof result.recognition !== "object") return value;
  const recognition = result.recognition as Record<string, unknown>;
  if (typeof recognition.label === "string" && recognition.label.trim()) return value;
  const alternative = Array.isArray(recognition.alternatives)
    ? recognition.alternatives.find((item) => typeof item === "string" && item.trim())
    : null;
  recognition.label = alternative ?? fallbackFamilyLabels[String(recognition.exerciseFamily)] ?? "Strength exercise attempt";
  return value;
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

function usage(payload: Record<string, unknown>) {
  const raw = payload.usageMetadata && typeof payload.usageMetadata === "object" ? payload.usageMetadata as Record<string, unknown> : {};
  return {
    promptTokens: typeof raw.promptTokenCount === "number" ? Math.max(0, Math.trunc(raw.promptTokenCount)) : 0,
    outputTokens: typeof raw.candidatesTokenCount === "number" ? Math.max(0, Math.trunc(raw.candidatesTokenCount)) : 0,
    thinkingTokens: typeof raw.thoughtsTokenCount === "number" ? Math.max(0, Math.trunc(raw.thoughtsTokenCount)) : 0,
  };
}

function verificationReason(draft: AnalysisCandidate): string | null {
  const finding = draft.priorityCorrections[0];
  if (!finding) return null;
  if (draft.recognition.confidence < 0.82) return "Exercise or variation confidence needs a closer evidence check";
  if (draft.status === "partial") return "Partial analysis needs a closer evidence check";
  if (draft.recognition.variation) return "The detected variation needs a closer evidence check";
  if (finding.evidence.some((moment) => moment.confidence < 0.88)) return "Priority evidence confidence needs a closer check";
  const subtleClaim = `${finding.title} ${finding.detail} ${finding.correction ?? ""}`;
  if (/asymmetr|left|right|slight|subtle|late|final|drift|shift|changes?/i.test(subtleClaim)) return "The priority correction describes a subtle movement change";
  return null;
}

function verificationWindow(draft: AnalysisCandidate, durationMs: number) {
  const evidence = draft.priorityCorrections[0]?.evidence[0];
  if (!evidence) return null;
  return {
    startSeconds: Math.max(0, evidence.startMs - 1_000) / 1_000,
    endSeconds: Math.min(durationMs, evidence.endMs + 1_000) / 1_000,
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
              { fileData: { mimeType: input.file.mimeType, fileUri: input.file.uri }, videoMetadata: { fps: 6 } },
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
          return validateAnalysisCandidate(pinUsableRecognition(JSON.parse(responseText(payload))), input.durationMs);
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

    async verifyAnalysis(input: { file: GeminiFile; draft: AnalysisCandidate; durationMs: number }): Promise<AnalysisCandidate> {
      const reason = verificationReason(input.draft);
      const window = verificationWindow(input.draft, input.durationMs);
      const checkedFinding = input.draft.priorityCorrections[0];
      if (!reason || !window || !checkedFinding) {
        return {
          ...input.draft,
          verification: { performed: false, reason: null, outcome: "not-needed", checkedFindingId: null },
        };
      }

      const prompt = `You are the evidence verifier for a strength-coaching result. Inspect only the supplied short interval from the original recording and audit the single priority correction below.

Confirm it only when the cited joint, body segment, or implement path is clearly visible. Revise the finding when the movement is visible but its wording or evidence timestamp is imprecise. Reject it when the clip does not visually prove the claim. Do not infer muscle activation, pain, hidden positions, intent, or internal forces. Do not discuss the camera or recording setup. A small change must be described conservatively and specifically.

Exercise: ${input.draft.recognition.label}
Variation: ${input.draft.recognition.variation ?? "none"}
Original-video interval supplied: ${window.startSeconds}s to ${window.endSeconds}s.
Draft finding: ${JSON.stringify(checkedFinding)}

For confirmed, return the original finding. For revised, return one complete corrected finding whose evidence timestamps remain absolute milliseconds from the start of the original video and fall inside the original-video interval above. For rejected, return finding as null.`;
      const response = await fetcher(`${API}/models/${encodeURIComponent(model)}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              {
                fileData: { mimeType: input.file.mimeType, fileUri: input.file.uri },
                videoMetadata: { fps: 24, startOffset: `${window.startSeconds}s`, endOffset: `${window.endSeconds}s` },
              },
              { text: prompt },
            ],
          }],
          generationConfig: {
            mediaResolution: "MEDIA_RESOLUTION_HIGH",
            responseMimeType: "application/json",
            responseJsonSchema: VERIFICATION_JSON_SCHEMA,
          },
        }),
      });
      const payload = await responseJson(response, "Gemini evidence verification failed");
      const raw = JSON.parse(responseText(payload)) as Record<string, unknown>;
      if (!["confirmed", "revised", "rejected"].includes(String(raw.outcome)) || typeof raw.reason !== "string" || !raw.reason.trim()) throw new Error("Gemini returned an invalid evidence verification");

      let merged: AnalysisCandidate = input.draft;
      if (raw.outcome === "revised") {
        if (!raw.finding || typeof raw.finding !== "object") throw new Error("A revised verification requires a finding");
        merged = {
          ...input.draft,
          priorityCorrections: [
            { ...raw.finding as AnalysisCandidate["priorityCorrections"][number], id: checkedFinding.id },
            ...input.draft.priorityCorrections.slice(1),
          ],
        };
      } else if (raw.outcome === "rejected") {
        merged = {
          ...input.draft,
          priorityCorrections: input.draft.priorityCorrections.slice(1),
          nextSetPlan: input.draft.nextSetPlan.filter((item) => item.relatedFindingId !== checkedFinding.id),
        };
      }
      const validated = validateAnalysisCandidate(merged, input.durationMs);
      return {
        ...validated,
        verification: {
          performed: true,
          reason,
          outcome: raw.outcome as "confirmed" | "revised" | "rejected",
          checkedFindingId: checkedFinding.id,
          usage: usage(payload),
        },
      };
    },

    async deleteFile(name: string): Promise<void> {
      const response = await fetcher(`${API}/${name}?key=${key}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error(`Gemini file cleanup failed: ${response.status}`);
    },
  };
}
