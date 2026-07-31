import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import {
  ANALYSIS_DECISION_SCHEMA,
  COMBINED_ANALYSIS_SCHEMA,
  buildTargetedContradictionReviewPrompt,
  buildSinglePassAnalysisPrompt,
  buildWriterAuditPrompt,
  detectRawFactualContradictions,
  mergeWriterCopy,
  parseAnalysisDecision,
  parseCombinedAnalysisResponse,
  parseWriterAuditResponse,
  targetedReviewWindows,
  writerAuditSchema,
} from "../supabase/functions/_shared/single-pass-analysis.ts";
import {
  buildTextGenerateContentRequest,
  buildVideoGenerateContentRequest,
  createGenerateContentClient,
} from "../supabase/functions/_shared/gemini-generate.ts";
import { createGeminiFilesClient, type GeminiFile } from "../supabase/functions/_shared/gemini-files.ts";
import { resolveRegressionProfile } from "./regression-profile.ts";

const MAX_WRITER_REPAIR_ATTEMPTS = 2;

function requiredArgument(index: number, label: string): string {
  const value = process.argv[index];
  if (!value) throw new Error(`Usage: node --experimental-strip-types --env-file=.env.local scripts/run-single-pass-regression.ts <video> <duration-ms> [output-json]\nMissing ${label}.`);
  return value;
}

async function waitForActiveFile(files: ReturnType<typeof createGeminiFilesClient>, initial: GeminiFile): Promise<GeminiFile> {
  let file = initial;
  const deadline = Date.now() + 180_000;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
    file = await files.getFile(file.name);
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini video file did not become active (state: ${file.state}).`);
  return file;
}

const videoPath = resolve(requiredArgument(2, "video path"));
const durationMs = Number(requiredArgument(3, "duration in milliseconds"));
if (!Number.isInteger(durationMs) || durationMs <= 0) throw new Error("Duration must be a positive integer in milliseconds.");
const outputPath = resolve(process.argv[4] ?? `${videoPath}.single-pass-regression.json`);
const apiKey = process.env.GEMINI_API_KEY ?? "";
if (!apiKey) throw new Error("GEMINI_API_KEY is required.");
const profile = resolveRegressionProfile(process.env);

const files = createGeminiFilesClient({ apiKey });
const generation = createGenerateContentClient({ apiKey });
const bytes = await readFile(videoPath);
let uploaded: GeminiFile | null = null;

try {
  uploaded = await waitForActiveFile(files, await files.uploadVideo({
    body: new Blob([bytes], { type: "video/mp4" }),
    contentLength: bytes.byteLength,
    mimeType: "video/mp4",
    displayName: `non-persisting-regression-${basename(videoPath)}`,
  }));

  const analysisStartedAt = Date.now();
  const analystResponse = await generation.generate(profile.analystModel, buildVideoGenerateContentRequest({
    file: { uri: uploaded.uri, mimeType: uploaded.mimeType },
    prompt: buildSinglePassAnalysisPrompt(durationMs),
    schema: ANALYSIS_DECISION_SCHEMA,
    fps: profile.requestedFps,
    thinkingLevel: profile.analystThinking,
    mediaResolution: profile.mediaResolution,
  }));
  let decision;
  let analystContradictions;
  try {
    analystContradictions = detectRawFactualContradictions(analystResponse.value, durationMs);
    decision = parseAnalysisDecision(analystResponse.value, durationMs);
  } catch (error) {
    await writeFile(outputPath, `${JSON.stringify({
      run: {
        analystModel: profile.analystModel,
        requestedFps: profile.requestedFps,
        mediaResolution: profile.mediaResolution,
        analystThinking: profile.analystThinking,
        analystUsage: analystResponse.usage,
        validationFailure: error instanceof Error ? error.message : String(error),
      },
      rejectedDecision: analystResponse.value,
    }, null, 2)}\n`, "utf8");
    throw error;
  }
  let writerUsage = null;
  const writerRepairUsage: unknown[] = [];
  let writerAudit = null;
  if (decision.status !== "unable") {
    const writerPrompt = buildWriterAuditPrompt(decision);
    const writerResponse = await generation.generate(profile.writerModel, buildTextGenerateContentRequest({
      prompt: writerPrompt,
      schema: writerAuditSchema(decision),
      thinkingLevel: profile.writerThinking,
    }));
    writerUsage = writerResponse.usage;
    let currentWriterValue = writerResponse.value;
    let latestWriterValidationError: unknown = null;
    for (let attempt = 0; attempt <= MAX_WRITER_REPAIR_ATTEMPTS; attempt += 1) {
      try {
        writerAudit = parseWriterAuditResponse(currentWriterValue, decision, durationMs);
        break;
      } catch (validationError) {
        latestWriterValidationError = validationError;
        if (attempt === MAX_WRITER_REPAIR_ATTEMPTS) throw validationError;
      }
      const repairedWriterResponse = await generation.generate(profile.writerModel, buildTextGenerateContentRequest({
        prompt: `${writerPrompt}

The previous writer-audit JSON was rejected. Fix only the validation issue and return the complete coaching and contradictions object. Do not change analyst-owned facts.
Validation issue: ${latestWriterValidationError instanceof Error ? latestWriterValidationError.message : String(latestWriterValidationError)}
Rejected writer audit:
${JSON.stringify(currentWriterValue)}`,
        schema: writerAuditSchema(decision),
        thinkingLevel: profile.writerThinking,
      }));
      writerRepairUsage.push(repairedWriterResponse.usage);
      currentWriterValue = repairedWriterResponse.value;
    }
  }
  let writerCopy = writerAudit?.coaching ?? null;
  const contradictions = [...analystContradictions, ...(writerAudit?.contradictions ?? [])].slice(0, 3);
  let reviewUsage = null;
  let reviewWindows: Array<{ startMs: number; endMs: number }> = [];
  if (contradictions.length > 0) {
    reviewWindows = targetedReviewWindows(decision, contradictions, durationMs);
    const reviewedResponse = await generation.generate(profile.analystModel, buildVideoGenerateContentRequest({
      file: { uri: uploaded.uri, mimeType: uploaded.mimeType },
      prompt: buildTargetedContradictionReviewPrompt(decision, writerCopy, contradictions),
      schema: COMBINED_ANALYSIS_SCHEMA,
      fps: profile.requestedFps,
      thinkingLevel: "medium",
      mediaResolution: profile.mediaResolution,
      windows: reviewWindows,
    }));
    const reviewed = parseCombinedAnalysisResponse(reviewedResponse.value, durationMs);
    decision = reviewed.decision;
    writerCopy = reviewed.writerCopy;
    reviewUsage = reviewedResponse.usage;
  }
  const analysisDurationMs = Date.now() - analysisStartedAt;
  const result = mergeWriterCopy(decision, writerCopy);

  const report = {
    run: {
      analystModel: profile.analystModel,
      requestedFps: profile.requestedFps,
      mediaResolution: profile.mediaResolution,
      analystThinking: profile.analystThinking,
      writerModel: profile.writerModel,
      writerThinking: profile.writerThinking,
      analysisDurationMs,
      analystUsage: analystResponse.usage,
      writerUsage,
      writerRepairUsage,
      contradictions,
      reviewWindows,
      reviewUsage,
    },
    decision,
    writerCopy,
    result,
  };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, run: report.run, score: result.score, repCount: result.setSummary.totalReps, correctionCount: result.priorityCorrections.length, corrections: result.priorityCorrections.map((finding) => ({ id: finding.id, severity: finding.severity, title: finding.title, detail: finding.detail, correction: finding.correction, cue: finding.cue, evidence: finding.evidence.map((item) => ({ peakMs: item.peakMs, repNumber: item.repNumber, phase: item.phase, visualEvidence: item.visualEvidence })) })) }, null, 2));
} finally {
  if (uploaded) await files.deleteFile(uploaded.name).catch(() => undefined);
}
