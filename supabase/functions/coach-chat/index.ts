import { createAdminClient, requireUserId } from "../_shared/auth.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { createGeminiCoachClient } from "../_shared/gemini-coach.ts";
import { createGeminiVideoClient, type GeminiFile } from "../_shared/gemini-video.ts";
import { resultPayload } from "../_shared/result-payload.ts";
import { coachChatHandler, type CoachThread } from "./handler.ts";

const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash";
const files = createGeminiVideoClient({ apiKey, model });
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
    targetIntent: typeof row.target_intent === "string" ? row.target_intent : null,
    geminiFileName: typeof row.gemini_file_name === "string" ? row.gemini_file_name : null,
    geminiFileUri: typeof row.gemini_file_uri === "string" ? row.gemini_file_uri : null,
    geminiFileState: row.gemini_file_state as CoachThread["geminiFileState"],
  };
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
      return { id: session.id, userId: session.user_id, status: session.status, videoPath: session.video_path, result: resultPayload(session, result) };
    },
    loadThread: async (sessionId, userId) => {
      const { data, error } = await admin.from("coach_threads").select("*").eq("session_id", sessionId).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data ? mapThread(data) : null;
    },
    createThread: async (sessionId, userId, targetIntent) => {
      const { data, error } = await admin.from("coach_threads").insert({ session_id: sessionId, user_id: userId, target_intent: targetIntent }).select("*").single();
      if (error) throw error;
      return mapThread(data);
    },
    updateTargetIntent: async (threadId, targetIntent) => {
      const { error } = await admin.from("coach_threads").update({ target_intent: targetIntent, updated_at: new Date().toISOString() }).eq("id", threadId);
      if (error) throw error;
    },
    loadMessages: async (threadId, userId) => {
      const { data, error } = await admin.from("coach_messages").select("id,thread_id,role,content,created_at").eq("thread_id", threadId).eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []).reverse().map((row) => ({ id: row.id, threadId: row.thread_id, role: row.role, content: row.content, createdAt: row.created_at }));
    },
    insertMessage: async (threadId, userId, role, content) => {
      const { data, error } = await admin.from("coach_messages").insert({ thread_id: threadId, user_id: userId, role, content }).select("id,thread_id,role,content,created_at").single();
      if (error) throw error;
      return { id: data.id, threadId: data.thread_id, role: data.role, content: data.content, createdAt: data.created_at };
    },
    ensureVideoFile: async (thread, session) => {
      let file: GeminiFile | null = thread.geminiFileName && thread.geminiFileUri && thread.geminiFileState
        ? { name: thread.geminiFileName, uri: thread.geminiFileUri, mimeType: "video/mp4", state: thread.geminiFileState }
        : null;
      if (!file) {
        if (!session.videoPath) throw new Error("Video path is missing");
        const { data: video, error } = await admin.storage.from("analysis-videos").download(session.videoPath);
        if (error) throw error;
        file = await files.uploadVideo({ body: video, contentLength: video.size, mimeType: video.type || "video/mp4", displayName: `coach-${session.id}.mp4` });
      }
      for (const delay of [0, 500, 1000, 2000, 4000, 8000]) {
        if (file.state !== "PROCESSING") break;
        if (delay) await wait(delay);
        file = await files.getFile(file.name);
      }
      await admin.from("coach_threads").update({ gemini_file_name: file.name, gemini_file_uri: file.uri, gemini_file_state: file.state, updated_at: new Date().toISOString() }).eq("id", thread.id);
      if (file.state !== "ACTIVE") throw new Error("Coach video processing failed");
      return file;
    },
    generateReply: ({ videoFile, prompt }) => coach.generateReply({ videoFile, prompt }),
  });
  return withCors(response);
});
