import type { GeminiFile } from "./gemini-video.ts";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createGeminiCoachClient(options: { apiKey: string; model: string; fetcher?: Fetcher }) {
  const fetcher = options.fetcher ?? fetch;
  const key = options.apiKey.trim();
  if (!key) throw new Error("Gemini API key is missing");

  return {
    async generateReply(input: { videoFile: GeminiFile; prompt: string }): Promise<string> {
      if (input.videoFile.state !== "ACTIVE") throw new Error("Coach video is not ready");
      const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { fileData: { fileUri: input.videoFile.uri, mimeType: input.videoFile.mimeType || "video/mp4" } },
            { text: input.prompt },
          ] }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0.35 },
        }),
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error(`Gemini coach failed: ${response.status}`);
      const candidates = payload.candidates;
      const first = Array.isArray(candidates) ? candidates[0] as Record<string, unknown> | undefined : undefined;
      const content = first?.content as Record<string, unknown> | undefined;
      const parts = Array.isArray(content?.parts) ? content.parts as Record<string, unknown>[] : [];
      const text = parts.map((part) => part.text).find((value) => typeof value === "string" && value.trim());
      if (typeof text !== "string" || !text.trim()) throw new Error("Gemini coach returned no reply");
      return text.trim().slice(0, 4000);
    },
  };
}
