import type { GeminiFile } from "./gemini-files.ts";
import { COACH_ANSWER_SCHEMA, COACH_LOCATION_SCHEMA } from "./coach-analysis.ts";
import { buildVideoGenerateContentRequest, createGenerateContentClient } from "./gemini-generate.ts";
import type { GeminiGovernance } from "./gemini-governance.ts";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createGeminiCoachClient(options: { apiKey: string; model: string; governance: GeminiGovernance; fetcher?: Fetcher }) {
  const key = options.apiKey.trim();
  if (!key) throw new Error("Gemini API key is missing");
  const client = createGenerateContentClient({ apiKey: key, governance: options.governance, fetcher: options.fetcher ?? fetch });

  function requireActive(file: GeminiFile) {
    if (file.state !== "ACTIVE") throw new Error("Coach video is not ready");
  }

  return {
    async locateQuestion(input: { videoFile: GeminiFile; prompt: string }) {
      requireActive(input.videoFile);
      return client.generate(options.model, buildVideoGenerateContentRequest({
        file: input.videoFile,
        prompt: input.prompt,
        schema: COACH_LOCATION_SCHEMA,
        fps: 6,
        thinkingLevel: "high",
        mediaResolution: "MEDIA_RESOLUTION_MEDIUM",
      }));
    },
    async answerQuestion(input: { videoFile: GeminiFile; prompt: string; window?: { startMs: number; endMs: number } | null }) {
      requireActive(input.videoFile);
      return client.generate(options.model, buildVideoGenerateContentRequest({
        file: input.videoFile,
        prompt: input.prompt,
        schema: COACH_ANSWER_SCHEMA,
        fps: 12,
        thinkingLevel: "high",
        mediaResolution: "MEDIA_RESOLUTION_MEDIUM",
        window: input.window,
      }));
    },
  };
}
