import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createCoachThread, sendCoachMessage } from "../src/features/coach/api.ts";
import { createGeminiFilesClient } from "../supabase/functions/_shared/gemini-files.ts";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

async function main() {
  const videoPath = process.argv[2];
  if (!videoPath || !fs.existsSync(videoPath)) throw new Error("Usage: tsx scripts/smoke-coach-live.ts <real-video.mp4>");
  const supabaseUrl = required("EXPO_PUBLIC_SUPABASE_URL");
  const anonKey = required("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = required("GEMINI_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const files = createGeminiFilesClient({ apiKey: geminiKey });
  const nonce = crypto.randomUUID();
  const email = `coach-smoke-${nonce}@example.invalid`;
  const password = `Sm0ke-${nonce}!`;
  const sessionId = crypto.randomUUID();
  const storagePath = `${sessionId}/original.mp4`;
  let userId: string | null = null;
  let geminiFileName: string | null = null;

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error("Smoke user was not created");
    userId = created.data.user.id;
    const signedIn = await userClient.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("Smoke user could not sign in");
    const token = signedIn.data.session.access_token;

    const video = fs.readFileSync(path.resolve(videoPath));
    const uploaded = await admin.storage.from("analysis-videos").upload(storagePath, video, { contentType: "video/mp4", upsert: false });
    if (uploaded.error) throw uploaded.error;
    const sessionInsert = await admin.from("analysis_sessions").insert({
      id: sessionId,
      user_id: userId,
      status: "complete",
      stage: "coaching",
      video_path: storagePath,
      duration_ms: 32_800,
      camera_view: "front-diagonal",
      detected_label: "Bent-over dumbbell row",
      detected_equipment: ["dumbbell"],
      recognition_confidence: 0.95,
      recognition_alternatives: [],
      exercise_family: "row",
      completed_at: new Date().toISOString(),
    });
    if (sessionInsert.error) throw sessionInsert.error;
    const resultInsert = await admin.from("analysis_results").insert({
      session_id: sessionId,
      status: "complete",
      video_check: { outcome: "usable", usableObservations: ["torso and dumbbells visible"], limitations: [], retryReason: null, retryInstruction: null },
      overall_assessment: "The torso position changes during later rows.",
      score: 62,
      score_rationale: [],
      did_well: [],
      priority_corrections: [{ id: "torso-rise", title: "Keep torso height steady", detail: "The torso rises during the pull.", whyItMatters: "A repeatable torso position makes the row easier to compare.", correction: "Hold the same visible hip hinge.", cue: "Freeze the torso.", actionableCorrection: null, severity: "important", evidence: [{ startMs: 11_500, peakMs: 12_250, endMs: 13_000, repNumber: 4, phase: "top", visualEvidence: "The torso rises as the dumbbells reach the top.", coachingNote: "Hold the same torso height.", visibleBodyAreas: ["torso", "dumbbells"], confidence: 0.95, focusRegion: null }] }],
      coaching_cues: [],
      set_context: { cameraView: "front-diagonal", visibleReferences: ["torso", "dumbbells"], sequenceSummary: "Repeated bent-over rows.", changeAcrossSet: "The torso rises during pulls.", coachingBasis: "Keep torso height steady." },
      set_summary: { totalReps: null, consistentReps: null, verdict: "Torso height changes." },
      rep_timeline: [],
      next_set_plan: [],
      analysis_version: "coach-live-smoke-v1",
    });
    if (resultInsert.error) throw resultInsert.error;

    const clientOptions = { accessToken: token, apiKey: anonKey, baseUrl: supabaseUrl };
    const createdThread = await createCoachThread({ ...clientOptions, sessionId });
    const threadId = createdThread.id;
    const clientMessageId = `smoke_${nonce}`;
    const request = { ...clientOptions, threadId, sessionId, clientMessageId, message: "Around 12 seconds, what happens to my torso as I row?" };
    const first = await sendCoachMessage(request);
    const grounding = first.assistantMessage?.grounding;
    if (!grounding || grounding.scope !== "focused_window" || !Array.isArray(grounding.citations) || !grounding.citations.length) throw new Error("Smoke response was not video-grounded");
    if (grounding.citations.some((item: { timeMs: number }) => item.timeMs < grounding.startMs || item.timeMs > grounding.endMs)) throw new Error("Smoke citation was outside the reviewed range");
    const retried = await sendCoachMessage(request);
    if (retried.userMessage?.id !== first.userMessage?.id || retried.assistantMessage?.id !== first.assistantMessage?.id) throw new Error("Idempotent retry returned a duplicate exchange");

    const messages = await admin.from("coach_messages").select("id,role,exchange_key,grounding").eq("thread_id", threadId);
    if (messages.error || messages.data?.length !== 2 || messages.data.some((item) => item.exchange_key !== clientMessageId)) throw messages.error ?? new Error("Atomic smoke exchange was not persisted exactly once");
    const storedSession = await admin.from("analysis_sessions").select("gemini_file_name,gemini_file_state").eq("id", sessionId).single();
    if (storedSession.error || storedSession.data.gemini_file_state !== "ACTIVE") throw storedSession.error ?? new Error("Session Gemini file cache was not active");
    geminiFileName = storedSession.data.gemini_file_name;
    const storedResult = await admin.from("analysis_results").select("score").eq("session_id", sessionId).single();
    if (storedResult.error || Number(storedResult.data.score) !== 62) throw storedResult.error ?? new Error("Coach changed the saved score");
    process.stdout.write(`${JSON.stringify({ status: "passed", threadId, scope: grounding.scope, startMs: grounding.startMs, endMs: grounding.endMs, citations: grounding.citations.length, persistedMessages: messages.data.length, retryDeduplicated: true, savedScore: Number(storedResult.data.score), sessionFileState: storedSession.data.gemini_file_state }, null, 2)}\n`);
  } finally {
    if (geminiFileName) await files.deleteFile(geminiFileName).catch(() => undefined);
    await admin.storage.from("analysis-videos").remove([storagePath]).catch(() => undefined);
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
