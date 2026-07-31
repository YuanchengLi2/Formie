import type { GeminiFile } from "./gemini-files.ts";

export type CoachVideoSession = {
  id: string;
  videoPath: string | null;
  geminiFileName: string | null;
  geminiFileUri: string | null;
  geminiFileState: GeminiFile["state"] | null;
};

type Dependencies = {
  getFile: (name: string) => Promise<GeminiFile>;
  uploadSessionVideo: (session: CoachVideoSession) => Promise<GeminiFile>;
  saveSessionFile: (sessionId: string, file: GeminiFile) => Promise<void>;
  wait: (milliseconds: number) => Promise<void>;
};

function expired(error: unknown): boolean {
  return error instanceof Error && /(?:^|\D)404(?:\D|$)/.test(error.message);
}

export async function ensureCoachVideoFile(session: CoachVideoSession, deps: Dependencies): Promise<GeminiFile> {
  if (!session.videoPath) throw new Error("Video path is missing");
  let file: GeminiFile | null = null;
  if (session.geminiFileName) {
    try {
      file = await deps.getFile(session.geminiFileName);
      if (file.state === "FAILED") file = null;
    } catch (error) {
      if (!expired(error)) throw error;
    }
  }
  if (!file) {
    file = await deps.uploadSessionVideo(session);
    if (file.state === "PROCESSING") await deps.saveSessionFile(session.id, file);
  }
  for (const delay of [0, 1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
    if (file.state !== "PROCESSING") break;
    if (delay) await deps.wait(delay);
    file = await deps.getFile(file.name);
  }
  if (file.state !== "ACTIVE") throw new Error("Coach video processing failed");
  await deps.saveSessionFile(session.id, file);
  return file;
}
