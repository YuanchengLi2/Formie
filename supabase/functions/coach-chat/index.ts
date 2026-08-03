import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { createGeminiCoachClient } from "../_shared/gemini-coach.ts";
import { createGeminiFilesClient } from "../_shared/gemini-files.ts";
import { coachMessageSchema, type CoachMessage } from "../_shared/coach-contract.ts";
import { ensureCoachVideoFile } from "../_shared/coach-video-file.ts";
import { resultPayload } from "../_shared/result-payload.ts";
import { coachChatHandler, type CoachThread } from "./handler.ts";

const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash";
const files = createGeminiFilesClient({ apiKey });
const coach = createGeminiCoachClient({ apiKey, model });
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

function mapThread(row: Record<string, unknown>): CoachThread {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sessionId: String(row.session_id),
    title: typeof row.title === "string" ? row.title : null,
    targetIntent: typeof row.target_intent === "string" ? row.target_intent : null,
    geminiFileName: typeof row.gemini_file_name === "string" ? row.gemini_file_name : null,
    geminiFileUri: typeof row.gemini_file_uri === "string" ? row.gemini_file_uri : null,
    geminiFileState: row.gemini_file_state as CoachThread["geminiFileState"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapMessage(row: Record<string, unknown>): CoachMessage {
  return coachMessageSchema.parse({
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    grounding: row.grounding ?? null,
  });
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  const admin = createAdminClient();

  const response = await coachChatHandler(request, {
    authenticate: (incoming) => requireUserId(incoming, admin),
    loadSession: async (sessionId, userId) => {
      const { data: session, error } = await admin.from("analysis_sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      if (!session) return null;
      const { data: result, error: resultError } = await admin.from("analysis_results").select("*").eq("session_id", sessionId).maybeSingle();
      if (resultError) throw resultError;
      const { data: v49Run, error: v49Error } = session.active_v49_run_id
        ? await admin.from("analysis_v49_runs").select("public_result").eq("run_id", session.active_v49_run_id).eq("session_id", sessionId).maybeSingle()
        : { data: null, error: null };
      if (v49Error) throw v49Error;
      return {
        id: session.id,
        userId: session.user_id,
        status: session.status,
        durationMs: Number(session.duration_ms),
        videoPath: session.video_path,
        geminiFileName: typeof session.gemini_file_name === "string" ? session.gemini_file_name : null,
        geminiFileUri: typeof session.gemini_file_uri === "string" ? session.gemini_file_uri : null,
        geminiFileState: session.gemini_file_state ?? null,
        result: resultPayload(session, result, v49Run?.public_result ?? null),
      };
    },
    listThreads: async (userId) => {
      const { data, error } = await admin.from("coach_threads").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapThread);
    },
    loadThread: async (threadId, userId) => {
      const { data, error } = await admin.from("coach_threads").select("*").eq("id", threadId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data ? mapThread(data) : null;
    },
    createThread: async (sessionId, userId, targetIntent) => {
      const { data, error } = await admin.from("coach_threads").insert({ session_id: sessionId, user_id: userId, target_intent: targetIntent }).select("*").single();
      if (error) throw error;
      return mapThread(data);
    },
    renameThread: async (threadId, userId, title) => {
      const { data, error } = await admin.from("coach_threads").update({ title, updated_at: new Date().toISOString() }).eq("id", threadId).eq("user_id", userId).select("*").maybeSingle();
      if (error) throw error;
      return data ? mapThread(data) : null;
    },
    deleteThread: async (threadId, userId) => {
      const { data, error } = await admin.from("coach_threads").delete().eq("id", threadId).eq("user_id", userId).select("id").maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    updateTargetIntent: async (threadId, targetIntent) => {
      const { error } = await admin.from("coach_threads").update({ target_intent: targetIntent, updated_at: new Date().toISOString() }).eq("id", threadId);
      if (error) throw error;
    },
    loadMessages: async (threadId, userId) => {
      const { data, error } = await admin.from("coach_messages").select("id,thread_id,role,content,created_at,grounding").eq("thread_id", threadId).eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []).reverse().map((row) => mapMessage(row));
    },
    loadExchange: async (threadId, userId, exchangeKey) => {
      const { data, error } = await admin.from("coach_messages").select("id,thread_id,role,content,created_at,grounding,exchange_key").eq("thread_id", threadId).eq("user_id", userId).eq("exchange_key", exchangeKey);
      if (error) throw error;
      if (!data?.length) return null;
      const userMessage = data.find((row) => row.role === "user");
      const assistantMessage = data.find((row) => row.role === "assistant");
      return userMessage && assistantMessage ? { userMessage: mapMessage(userMessage), assistantMessage: mapMessage(assistantMessage) } : null;
    },
    ensureVideoFile: async (_thread, session) => ensureCoachVideoFile(session, {
      getFile: (name) => files.getFile(name),
      uploadSessionVideo: async (videoSession) => {
        if (!videoSession.videoPath) throw new Error("Video path is missing");
        const { data: video, error } = await admin.storage.from("analysis-videos").download(videoSession.videoPath);
        if (error) throw error;
        return files.uploadVideo({ body: video, contentLength: video.size, mimeType: video.type || "video/mp4", displayName: `coach-${videoSession.id}.mp4` });
      },
      saveSessionFile: async (sessionId, file) => {
        const { error } = await admin.from("analysis_sessions").update({ gemini_file_name: file.name, gemini_file_uri: file.uri, gemini_file_state: file.state, updated_at: new Date().toISOString() }).eq("id", sessionId);
        if (error) throw error;
      },
      wait,
    }),
    locateQuestion: async ({ videoFile, prompt }) => (await coach.locateQuestion({ videoFile, prompt })).value,
    answerQuestion: async ({ videoFile, prompt, window }) => (await coach.answerQuestion({ videoFile, prompt, window })).value,
    appendExchange: async (threadId, userId, exchangeKey, userContent, assistantContent, grounding) => {
      const { data, error } = await admin.rpc("append_coach_exchange", {
        p_thread_id: threadId,
        p_user_id: userId,
        p_exchange_key: exchangeKey,
        p_user_content: userContent,
        p_assistant_content: assistantContent,
        p_grounding: grounding,
      });
      if (error) throw error;
      const payload = data as Record<string, unknown> | null;
      if (!payload) throw new Error("Coach exchange was not saved");
      return { userMessage: coachMessageSchema.parse(payload.userMessage), assistantMessage: coachMessageSchema.parse(payload.assistantMessage) };
    },
  });
  return withCors(response);
});
