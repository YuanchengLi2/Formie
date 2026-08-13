const API = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_API = "https://generativelanguage.googleapis.com/upload/v1beta/files";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type GeminiFile = {
  name: string;
  uri: string;
  mimeType: string;
  state: "PROCESSING" | "ACTIVE" | "FAILED";
  failureReason?: string;
};

export async function reuseOrUploadGeminiFile(input: {
  existingName: string | null;
  getFile: (name: string) => Promise<GeminiFile>;
  upload: () => Promise<GeminiFile>;
}): Promise<GeminiFile> {
  if (!input.existingName) return input.upload();
  try {
    return await input.getFile(input.existingName);
  } catch (error) {
    if (!(error instanceof Error) || !/(?:^|\D)404(?:\D|$)/.test(error.message)) throw error;
    return input.upload();
  }
}

export async function waitForGeminiFile(input: {
  file: GeminiFile;
  getFile: (name: string) => Promise<GeminiFile>;
  wait?: (delayMs: number) => Promise<void>;
  delaysMs?: number[];
}): Promise<GeminiFile> {
  let file = input.file;
  const wait = input.wait ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  for (const delayMs of input.delaysMs ?? [250, 500, 1_000, 2_000, 4_000, 8_000, 12_000]) {
    if (file.state !== "PROCESSING") break;
    await wait(delayMs);
    file = await input.getFile(file.name);
  }
  return file;
}

function videoMimeType(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("quicktime") || normalized.includes("mov")) return "video/quicktime";
  if (normalized.includes("webm")) return "video/webm";
  return "video/mp4";
}

async function responseJson(response: Response, message: string): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const providerError = payload.error && typeof payload.error === "object" && !Array.isArray(payload.error)
      ? payload.error as Record<string, unknown>
      : null;
    const detail = typeof providerError?.message === "string" ? `: ${providerError.message}` : "";
    throw Object.assign(new Error(`${message}: ${response.status}${detail}`), {
      httpStatus: response.status,
      providerStatus: `HTTP_${response.status}`,
    });
  }
  return payload;
}

function parseFile(value: unknown): GeminiFile {
  const file = (value && typeof value === "object" && "file" in value ? (value as { file: unknown }).file : value) as Record<string, unknown> | null;
  if (!file || typeof file.name !== "string" || typeof file.uri !== "string") throw new Error("Gemini returned invalid file metadata");
  const state = String(file.state ?? "PROCESSING").toUpperCase();
  if (state !== "PROCESSING" && state !== "ACTIVE" && state !== "FAILED") throw new Error("Gemini returned an unknown file state");
  const failure = file.error && typeof file.error === "object" && !Array.isArray(file.error)
    ? file.error as Record<string, unknown>
    : null;
  const failureReason = typeof failure?.message === "string" ? failure.message : undefined;
  return { name: file.name, uri: file.uri, mimeType: typeof file.mimeType === "string" ? file.mimeType : "video/mp4", state, ...(failureReason ? { failureReason } : {}) };
}

export function createGeminiFilesClient({ apiKey, fetcher = fetch }: { apiKey: string; fetcher?: Fetcher }) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  const key = encodeURIComponent(apiKey);
  return {
    async uploadVideo(input: { body: BodyInit; contentLength: number; mimeType: string; displayName: string }): Promise<GeminiFile> {
      const mimeType = videoMimeType(input.mimeType);
      const start = await fetcher(`${UPLOAD_API}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": String(input.contentLength), "X-Goog-Upload-Header-Content-Type": mimeType },
        body: JSON.stringify({ file: { display_name: input.displayName } }),
      });
      if (!start.ok) {
        throw Object.assign(new Error(`Gemini upload could not start: ${start.status}`), {
          httpStatus: start.status,
          providerStatus: `HTTP_${start.status}`,
        });
      }
      const uploadUrl = start.headers.get("x-goog-upload-url");
      if (!uploadUrl) throw new Error("Gemini upload URL is missing");
      const uploaded = await fetcher(uploadUrl, { method: "POST", headers: { "Content-Length": String(input.contentLength), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize", "Content-Type": mimeType }, body: input.body });
      return parseFile(await responseJson(uploaded, "Gemini upload failed"));
    },
    async getFile(name: string): Promise<GeminiFile> {
      return parseFile(await responseJson(await fetcher(`${API}/${name}?key=${key}`), "Gemini file status failed"));
    },
    async deleteFile(name: string): Promise<void> {
      const response = await fetcher(`${API}/${name}?key=${key}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw new Error(`Gemini file delete failed: ${response.status}`);
    },
  };
}
