import fs from "node:fs";
import path from "node:path";
import { buildCoachGrounding, normalizeCoachLocation, parseCoachAnswer, parseCoachLocation, renderCoachAnswer } from "../supabase/functions/_shared/coach-analysis.ts";
import { createGeminiCoachClient } from "../supabase/functions/_shared/gemini-coach.ts";
import { createGeminiFilesClient, type GeminiFile } from "../supabase/functions/_shared/gemini-files.ts";
import { buildCoachAnswerPrompt, buildCoachLocatorPrompt } from "../supabase/functions/_shared/coach-prompt.ts";

type BenchmarkCase = {
  id: string;
  category: string;
  question: string;
  expectedTimestampMs: number | null;
  savedAnalysis: string;
  video: { id: string; filename: string; durationMs: number; exercise: string; view: string };
  humanLabel: unknown;
};

type Manifest = { benchmark: Record<string, unknown>; cases: BenchmarkCase[] };

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitUntilActive(files: ReturnType<typeof createGeminiFilesClient>, initial: GeminiFile): Promise<GeminiFile> {
  let current = initial;
  for (let attempt = 0; attempt < 60 && current.state === "PROCESSING"; attempt += 1) {
    await delay(2_000);
    current = await files.getFile(current.name);
  }
  if (current.state !== "ACTIVE") throw new Error(`Video ${current.name} did not become active`);
  return current;
}

async function upload(files: ReturnType<typeof createGeminiFilesClient>, videoPath: string, displayName: string): Promise<GeminiFile> {
  const body = fs.readFileSync(videoPath);
  return waitUntilActive(files, await files.uploadVideo({
    body: body as unknown as BodyInit,
    contentLength: body.byteLength,
    mimeType: "video/mp4",
    displayName,
  }));
}

async function main() {
  const [manifestPath, videoDirectory, outputPath] = process.argv.slice(2);
  if (!manifestPath || !videoDirectory || !outputPath) {
    throw new Error("Usage: npx tsx scripts/run-coach-qa.ts <manifest.json> <video-directory> <output.json>");
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  if (manifest.cases.length !== 20) throw new Error("Coach QA manifest must contain exactly 20 cases");
  const files = createGeminiFilesClient({ apiKey });
  const coach = createGeminiCoachClient({ apiKey, model });
  const results: Array<Record<string, unknown>> = [];
  const groups = new Map<string, BenchmarkCase[]>();
  for (const item of manifest.cases) groups.set(item.video.id, [...(groups.get(item.video.id) ?? []), item]);

  for (const [videoId, cases] of groups) {
    const videoPath = path.resolve(videoDirectory, cases[0].video.filename);
    if (!fs.existsSync(videoPath)) throw new Error(`Missing video: ${videoPath}`);
    process.stdout.write(`Uploading ${videoId} (${cases.length} questions)\n`);
    let videoFile: GeminiFile | null = null;
    try {
      videoFile = await upload(files, videoPath, `formai-coach-qa-${videoId}`);
      for (const [index, fixture] of cases.entries()) {
        const startedAt = Date.now();
        process.stdout.write(`[${results.length + 1}/20] ${fixture.id}\n`);
        try {
          const locator = await coach.locateQuestion({
            videoFile,
            prompt: buildCoachLocatorPrompt({ analysis: fixture.savedAnalysis, history: [], message: fixture.question, durationMs: fixture.video.durationMs }),
          });
          const location = normalizeCoachLocation(parseCoachLocation(locator.value), fixture.video.durationMs);
          if (location.scope === "insufficient") {
            results.push({ id: fixture.id, videoId, category: fixture.category, question: fixture.question, expectedTimestampMs: fixture.expectedTimestampMs, status: "complete", answer: location.clarification, grounding: { scope: "insufficient", startMs: null, endMs: null, citations: [] }, location, latencyMs: Date.now() - startedAt, usage: { locator: locator.usage, answer: null }, review: null });
            continue;
          }
          const reviewedDurationMs = location.scope === "focused_window" ? Number(location.endMs) - Number(location.startMs) : fixture.video.durationMs;
          const answerResult = await coach.answerQuestion({
            videoFile,
            window: location.scope === "focused_window" ? { startMs: Number(location.startMs), endMs: Number(location.endMs) } : null,
            prompt: buildCoachAnswerPrompt({ analysis: fixture.savedAnalysis, history: [], message: fixture.question, durationMs: fixture.video.durationMs, location }),
          });
          const structuredAnswer = parseCoachAnswer(answerResult.value, reviewedDurationMs);
          const grounding = buildCoachGrounding(location, structuredAnswer, fixture.video.durationMs);
          results.push({ id: fixture.id, videoId, category: fixture.category, question: fixture.question, expectedTimestampMs: fixture.expectedTimestampMs, status: "complete", answer: renderCoachAnswer(structuredAnswer, grounding), structuredAnswer, grounding, location, latencyMs: Date.now() - startedAt, usage: { locator: locator.usage, answer: answerResult.usage }, review: null });
        } catch (error) {
          results.push({ id: fixture.id, videoId, category: fixture.category, question: fixture.question, expectedTimestampMs: fixture.expectedTimestampMs, status: "failed", error: error instanceof Error ? error.message : String(error), latencyMs: Date.now() - startedAt, review: null });
        }
        fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), model, benchmark: manifest.benchmark, results }, null, 2));
        if (index < cases.length - 1) await delay(750);
      }
    } finally {
      if (videoFile) await files.deleteFile(videoFile.name).catch(() => undefined);
    }
  }
  fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), model, benchmark: manifest.benchmark, results }, null, 2));
  process.stdout.write(`Wrote ${results.length} results to ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
