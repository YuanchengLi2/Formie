import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { analysisResultSchema } from "../src/features/analysis/result-schema";
import { parseSetDeclaration } from "../supabase/functions/_shared/set-declaration.ts";
import { fetchWithTimeout } from "./live-video-request.ts";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const sourceInput = process.argv[2];
if (!sourceInput) throw new Error("Usage: tsx scripts/smoke-analysis-live.ts <source-session-id | video-path> [duration-ms]");

const supabaseUrl = required("EXPO_PUBLIC_SUPABASE_URL");
const anonKey = required("EXPO_PUBLIC_SUPABASE_ANON_KEY");
const admin = createClient(supabaseUrl, required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const PIPELINE_VERSION = "gemini-problem-finder-v49";
const pollAttempts = Number(process.env.LIVE_POLL_ATTEMPTS ?? 90);
const keepSmokeSession = process.env.LIVE_KEEP_SMOKE_SESSION === "1";

type RunSnapshot = {
  run_id: string;
  status: string;
  raw_problem_output: Record<string, unknown> | null;
  raw_writer_output: Record<string, unknown> | null;
  public_result: Record<string, unknown> | null;
  model_call_count: number;
};

async function invokeUntilTerminal(accessToken: string, sessionId: string, runId: string, concurrent = false) {
  const invoke = () => fetchWithTimeout(`${supabaseUrl}/functions/v1/analyze-video-v49`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    const responses = attempt === 0 && concurrent ? await Promise.all([invoke(), invoke()]) : [await invoke()];
    for (const response of responses) {
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(`analyze-video-v49 failed (${response.status}): ${JSON.stringify(body)}`);
      if (["complete", "unable", "failed"].includes(String(body.status))) return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`v49 run ${runId} did not reach a terminal state`);
}

async function inspectRun(runId: string) {
  const [{ data: run, error: runError }, { data: stages, error: stagesError }, { data: telemetry, error: telemetryError }] = await Promise.all([
    admin.from("analysis_v49_runs").select("run_id,status,raw_problem_output,raw_writer_output,public_result,model_call_count").eq("run_id", runId).single(),
    admin.from("analysis_v49_stage_runs").select("stage,status,input_hash,output").eq("run_id", runId).order("stage"),
    admin.from("model_call_telemetry").select("v49_run_id,stage,model,requested_fps,status,error_code,prompt_tokens,output_tokens,thinking_tokens,duration_ms,estimated_cost_usd").eq("v49_run_id", runId).order("created_at"),
  ]);
  if (runError || stagesError || telemetryError) throw runError ?? stagesError ?? telemetryError;
  const snapshot = run as RunSnapshot;
  const problems = snapshot.raw_problem_output?.problems;
  if (!Array.isArray(problems)) throw new Error(`Run ${runId} has no immutable problem array`);
  for (const problem of problems as Array<Record<string, unknown>>) {
    if (!Array.isArray(problem.evidence)) throw new Error(`Problem evidence was separated or lost: ${JSON.stringify(problem)}`);
  }
  const problemCalls = (telemetry ?? []).filter((call) => call.model === "gemini-3.6-flash");
  const writerCalls = (telemetry ?? []).filter((call) => call.model === "gemini-3.1-flash-lite");
  if (problemCalls.length !== 1) throw new Error(`Expected exactly one problem-finder call: ${JSON.stringify(telemetry)}`);
  if (snapshot.status === "complete" && writerCalls.length !== 1) throw new Error(`Expected exactly one writer call: ${JSON.stringify(telemetry)}`);
  if (snapshot.status === "unable" && (writerCalls.length !== 0 || snapshot.public_result || snapshot.raw_writer_output)) {
    throw new Error(`Unable run fabricated writer output: ${JSON.stringify(snapshot)}`);
  }
  if (Number(snapshot.model_call_count) !== (telemetry ?? []).length) throw new Error(`Stored model call count is inconsistent for ${runId}`);
  if (snapshot.public_result) analysisResultSchema.parse(snapshot.public_result);
  return { run: snapshot, stages, telemetry };
}

async function main() {
  let declaration = process.env.LIVE_SET_DECLARATION_JSON
    ? parseSetDeclaration(JSON.parse(process.env.LIVE_SET_DECLARATION_JSON))
    : null;
  let durationMs: number;
  let sourceVideo: Blob | Buffer;
  if (fs.existsSync(path.resolve(sourceInput))) {
    durationMs = Number(process.argv[3]);
    if (!Number.isInteger(durationMs) || durationMs <= 0 || !declaration) {
      throw new Error("A local video requires a positive duration and LIVE_SET_DECLARATION_JSON");
    }
    sourceVideo = fs.readFileSync(path.resolve(sourceInput));
  } else {
    const source = await admin.from("analysis_sessions").select("video_path,analysis_video_path,duration_ms,set_declaration").eq("id", sourceInput).single();
    const retainedPath = source.data?.analysis_video_path ?? source.data?.video_path;
    if (source.error || !retainedPath || !source.data.duration_ms || !source.data.set_declaration) throw source.error ?? new Error("Source retained video or declaration is unavailable");
    declaration = declaration ?? parseSetDeclaration(source.data.set_declaration);
    const downloaded = await admin.storage.from("analysis-videos").download(retainedPath);
    if (downloaded.error) throw downloaded.error;
    durationMs = source.data.duration_ms;
    sourceVideo = downloaded.data;
  }

  const nonce = crypto.randomUUID();
  const email = `analysis-smoke-${nonce}@example.invalid`;
  const password = `Sm0ke-${nonce}!`;
  const sessionId = crypto.randomUUID();
  let userId: string | null = null;
  let storagePath: string | null = null;
  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("Could not create disposable smoke user");
    userId = created.data.user.id;
    storagePath = `${userId}/${sessionId}/analysis-input.mp4`;
    const uploaded = await admin.storage.from("analysis-videos").upload(storagePath, sourceVideo, { contentType: "video/mp4", upsert: false });
    if (uploaded.error) throw uploaded.error;
    const inserted = await admin.from("analysis_sessions").insert({
      id: sessionId, user_id: userId, status: "queued", stage: "input_ready", video_path: storagePath,
      analysis_video_path: storagePath, duration_ms: durationMs, analysis_duration_ms: durationMs,
      analysis_source_start_ms: 0, analysis_source_end_ms: durationMs, set_declaration: declaration,
      analysis_input_strategy: "capture_ready_video", analysis_preprocessing_confidence: 1,
      detected_label: declaration!.exercise.label, detected_equipment: [],
      recognition_confidence: 1, recognition_alternatives: [],
    });
    if (inserted.error) throw inserted.error;
    const signedIn = await userClient.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Could not sign in disposable smoke user");
    const accessToken = signedIn.data.session.access_token;

    const started = await admin.rpc("start_analysis_v49", { p_session_id: sessionId, p_user_id: userId, p_mode: "primary" });
    if (started.error || !started.data) throw started.error ?? new Error("Could not start primary v49 run");
    const firstRunId = String(started.data);
    await invokeUntilTerminal(accessToken, sessionId, firstRunId, process.env.LIVE_CONCURRENT_START === "1");
    const first = await inspectRun(firstRunId);

    let reanalysis = null;
    if (process.env.LIVE_VERIFY_REANALYSIS !== "0") {
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/reanalyze-video`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (response.status !== 202) throw new Error(`Reanalysis reset failed (${response.status}): ${await response.text()}`);
      const current = await admin.from("analysis_sessions").select("active_v49_run_id,pipeline_version").eq("id", sessionId).single();
      if (current.error || !current.data.active_v49_run_id || current.data.active_v49_run_id === firstRunId) throw current.error ?? new Error("Reanalysis did not create a new v49 run");
      await invokeUntilTerminal(accessToken, sessionId, current.data.active_v49_run_id);
      reanalysis = await inspectRun(current.data.active_v49_run_id);
    }

    process.stdout.write(`${JSON.stringify({ status: "passed", pipelineVersion: PIPELINE_VERSION, sessionId, first, reanalysis }, null, process.env.LIVE_COMPACT_REPORT === "1" ? 0 : 2)}\n`);
  } finally {
    if (!keepSmokeSession) {
      if (storagePath) await admin.storage.from("analysis-videos").remove([storagePath]).catch(() => undefined);
      if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  const detail = error instanceof Error
    ? error.stack
    : (() => {
        try { return JSON.stringify(error); } catch { return String(error); }
      })();
  process.stderr.write(`${detail}\n`);
  process.exitCode = 1;
});
