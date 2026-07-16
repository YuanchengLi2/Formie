import { buildCoachPrompt } from "../_shared/coach-prompt.ts";
import { parseCoachRequest, parseCoachSessionId, type CoachMessage } from "../_shared/coach-contract.ts";
import type { GeminiFile } from "../_shared/gemini-video.ts";

export type CoachSession = { id: string; userId: string; status: string; videoPath: string | null; result: unknown };
export type CoachThread = { id: string; userId: string; sessionId: string; targetIntent: string | null; geminiFileName: string | null; geminiFileUri: string | null; geminiFileState: GeminiFile["state"] | null };

export type CoachChatDependencies = {
  authenticate: (request: Request) => Promise<string>;
  loadSession: (sessionId: string, userId: string) => Promise<CoachSession | null>;
  loadThread: (sessionId: string, userId: string) => Promise<CoachThread | null>;
  createThread: (sessionId: string, userId: string, targetIntent: string | null) => Promise<CoachThread>;
  updateTargetIntent: (threadId: string, targetIntent: string) => Promise<void>;
  loadMessages: (threadId: string, userId: string) => Promise<CoachMessage[]>;
  insertMessage: (threadId: string, userId: string, role: "user" | "assistant", content: string) => Promise<CoachMessage>;
  ensureVideoFile: (thread: CoachThread, session: CoachSession) => Promise<GeminiFile>;
  generateReply: (input: { videoFile: GeminiFile; prompt: string; analysis: unknown; history: CoachMessage[] }) => Promise<string>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

export async function coachChatHandler(request: Request, deps: CoachChatDependencies): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const userId = await deps.authenticate(request);
    if (request.method === "GET") {
      const sessionId = parseCoachSessionId(new URL(request.url).searchParams.get("sessionId"));
      const session = await deps.loadSession(sessionId, userId);
      if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
      const thread = await deps.loadThread(sessionId, userId);
      if (!thread) return json({ thread: null, messages: [] }, 200);
      return json({ thread, messages: await deps.loadMessages(thread.id, userId) }, 200);
    }

    const input = parseCoachRequest(await request.json());
    const session = await deps.loadSession(input.sessionId, userId);
    if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    if (!['complete', 'partial'].includes(session.status)) return json({ message: "Choose a completed analysis", code: "ANALYSIS_NOT_READY" }, 409);
    if (!session.videoPath || !session.result) return json({ message: "The selected recording is unavailable", code: "VIDEO_NOT_FOUND" }, 409);

    let thread = await deps.loadThread(input.sessionId, userId);
    if (!thread) thread = await deps.createThread(input.sessionId, userId, input.targetIntent ?? null);
    else if (input.targetIntent && input.targetIntent !== thread.targetIntent) {
      await deps.updateTargetIntent(thread.id, input.targetIntent);
      thread = { ...thread, targetIntent: input.targetIntent };
    }

    const previous = (await deps.loadMessages(thread.id, userId)).slice(-19);
    const userMessage = await deps.insertMessage(thread.id, userId, "user", input.message);
    const history = [...previous, userMessage].slice(-20);
    const videoFile = await deps.ensureVideoFile(thread, session);
    const prompt = buildCoachPrompt({ analysis: session.result, targetIntent: input.targetIntent ?? thread.targetIntent, history, message: input.message });
    const reply = await deps.generateReply({ videoFile, prompt, analysis: session.result, history });
    const assistantMessage = await deps.insertMessage(thread.id, userId, "assistant", reply);
    return json({ threadId: thread.id, userMessage, assistantMessage }, 200);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    if (error instanceof SyntaxError) return json({ message: "A JSON request body is required", code: "INVALID_BODY" }, 400);
    if (error instanceof Error && /sessionId|message|Target intent|Unexpected|JSON object/.test(error.message)) return json({ message: error.message, code: "INVALID_BODY" }, 400);
    return json({ message: "Coach could not reply. Try again.", code: "COACH_FAILED" }, 500);
  }
}
