import { buildCoachAnswerPrompt, buildCoachLocatorPrompt, resolveCoachEvidence } from "../_shared/coach-prompt.ts";
import { parseCoachCommand, parseCoachThreadId, type CoachMessage } from "../_shared/coach-contract.ts";
import type { GeminiFile } from "../_shared/gemini-files.ts";
import { buildCoachGrounding, normalizeCoachLocation, parseCoachAnswer, parseCoachLocation, renderCoachAnswer, type CoachGrounding } from "../_shared/coach-analysis.ts";

export type CoachSession = { id: string; userId: string; status: string; durationMs: number; videoPath: string | null; geminiFileName: string | null; geminiFileUri: string | null; geminiFileState: GeminiFile["state"] | null; result: unknown };
export type CoachThread = { id: string; userId: string; sessionId: string; title: string | null; targetIntent: string | null; geminiFileName: string | null; geminiFileUri: string | null; geminiFileState: GeminiFile["state"] | null; createdAt: string; updatedAt: string };
export type PublicCoachThread = Pick<CoachThread, "id" | "userId" | "sessionId" | "title" | "targetIntent" | "createdAt" | "updatedAt">;

export type CoachChatDependencies = {
  authenticate: (request: Request) => Promise<string>;
  loadSession: (sessionId: string, userId: string) => Promise<CoachSession | null>;
  listThreads: (userId: string) => Promise<CoachThread[]>;
  loadThread: (threadId: string, userId: string) => Promise<CoachThread | null>;
  createThread: (sessionId: string, userId: string, targetIntent: string | null) => Promise<CoachThread>;
  renameThread: (threadId: string, userId: string, title: string) => Promise<CoachThread | null>;
  deleteThread: (threadId: string, userId: string) => Promise<boolean>;
  updateTargetIntent: (threadId: string, targetIntent: string) => Promise<void>;
  loadMessages: (threadId: string, userId: string) => Promise<CoachMessage[]>;
  loadExchange: (threadId: string, userId: string, exchangeKey: string) => Promise<{ userMessage: CoachMessage; assistantMessage: CoachMessage } | null>;
  ensureVideoFile: (thread: CoachThread, session: CoachSession) => Promise<GeminiFile>;
  locateQuestion: (input: { videoFile: GeminiFile; prompt: string }) => Promise<unknown>;
  answerQuestion: (input: { videoFile: GeminiFile; prompt: string; window: { startMs: number; endMs: number } | null }) => Promise<unknown>;
  appendExchange: (threadId: string, userId: string, exchangeKey: string, userContent: string, assistantContent: string, grounding: CoachGrounding) => Promise<{ userMessage: CoachMessage; assistantMessage: CoachMessage }>;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function publicThread(thread: CoachThread): PublicCoachThread {
  const { id, userId, sessionId, title, targetIntent, createdAt, updatedAt } = thread;
  return { id, userId, sessionId, title, targetIntent, createdAt, updatedAt };
}

export async function coachChatHandler(request: Request, deps: CoachChatDependencies): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const userId = await deps.authenticate(request);
    if (request.method === "GET") {
      const rawThreadId = new URL(request.url).searchParams.get("threadId");
      if (!rawThreadId) return json({ threads: (await deps.listThreads(userId)).map(publicThread) }, 200);
      const threadId = parseCoachThreadId(rawThreadId);
      const thread = await deps.loadThread(threadId, userId);
      if (!thread) return json({ message: "Conversation not found", code: "NOT_FOUND" }, 404);
      return json({ thread: publicThread(thread), messages: await deps.loadMessages(thread.id, userId) }, 200);
    }

    const input = parseCoachCommand(await request.json());
    if (input.action === "create") {
      const session = await deps.loadSession(input.sessionId, userId);
      if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
      if (!["complete", "partial"].includes(session.status)) return json({ message: "Choose a completed analysis", code: "ANALYSIS_NOT_READY" }, 409);
      return json({ thread: publicThread(await deps.createThread(input.sessionId, userId, null)) }, 201);
    }
    if (input.action === "rename") {
      if (!await deps.loadThread(input.threadId, userId)) return json({ message: "Conversation not found", code: "NOT_FOUND" }, 404);
      const thread = await deps.renameThread(input.threadId, userId, input.title);
      return thread ? json({ thread: publicThread(thread) }, 200) : json({ message: "Conversation not found", code: "NOT_FOUND" }, 404);
    }
    if (input.action === "delete") {
      if (!await deps.loadThread(input.threadId, userId)) return json({ message: "Conversation not found", code: "NOT_FOUND" }, 404);
      return await deps.deleteThread(input.threadId, userId) ? json({ deletedThreadId: input.threadId }, 200) : json({ message: "Conversation not found", code: "NOT_FOUND" }, 404);
    }

    const session = await deps.loadSession(input.sessionId, userId);
    if (!session) return json({ message: "Analysis not found", code: "NOT_FOUND" }, 404);
    if (!['complete', 'partial'].includes(session.status)) return json({ message: "Choose a completed analysis", code: "ANALYSIS_NOT_READY" }, 409);
    if (!session.videoPath || !session.result) return json({ message: "The selected recording is unavailable", code: "VIDEO_NOT_FOUND" }, 409);

    let thread = await deps.loadThread(input.threadId, userId);
    if (!thread) return json({ message: "Conversation not found", code: "NOT_FOUND" }, 404);
    if (thread.sessionId !== input.sessionId) return json({ message: "Conversation does not belong to this recording", code: "THREAD_SESSION_MISMATCH" }, 409);
    const exchangeKey = input.clientMessageId ?? crypto.randomUUID();
    if (input.clientMessageId) {
      const existing = await deps.loadExchange(thread.id, userId, exchangeKey);
      if (existing) return json({ threadId: thread.id, ...existing }, 200);
    }
    if (input.targetIntent && input.targetIntent !== thread.targetIntent) {
      await deps.updateTargetIntent(thread.id, input.targetIntent);
      thread = { ...thread, targetIntent: input.targetIntent };
    }

    const selectedEvidence = input.evidence ? resolveCoachEvidence(session.result, input.evidence) : null;
    const history = (await deps.loadMessages(thread.id, userId)).slice(-20);
    const videoFile = await deps.ensureVideoFile(thread, session);
    const targetIntent = input.targetIntent ?? thread.targetIntent;
    const locatorPrompt = buildCoachLocatorPrompt({ analysis: session.result, selectedEvidence, targetIntent, history, message: input.message, durationMs: session.durationMs });
    const location = normalizeCoachLocation(parseCoachLocation(await deps.locateQuestion({ videoFile, prompt: locatorPrompt })), session.durationMs);
    if (location.scope === "insufficient") {
      const grounding: CoachGrounding = { scope: "insufficient", startMs: null, endMs: null, citations: [] };
      const exchange = await deps.appendExchange(thread.id, userId, exchangeKey, input.message, location.clarification!, grounding);
      return json({ threadId: thread.id, ...exchange }, 200);
    }
    const answerPrompt = buildCoachAnswerPrompt({ analysis: session.result, targetIntent, history, message: input.message, durationMs: session.durationMs, location });
    const window = location.scope === "focused_window" ? { startMs: location.startMs!, endMs: location.endMs! } : null;
    const reviewedDurationMs = window ? window.endMs - window.startMs : session.durationMs;
    const answer = parseCoachAnswer(await deps.answerQuestion({ videoFile, prompt: answerPrompt, window }), reviewedDurationMs);
    const grounding = buildCoachGrounding(location, answer, session.durationMs);
    const reply = renderCoachAnswer(answer, grounding);
    const exchange = await deps.appendExchange(thread.id, userId, exchangeKey, input.message, reply, grounding);
    return json({ threadId: thread.id, ...exchange }, 200);
  } catch (error) {
    const eligibility = aiEligibilityErrorResponse(error);
    if (eligibility) return eligibility;
    if (error instanceof Error && error.message === "UNAUTHORIZED") return json({ message: "Sign in again", code: "UNAUTHORIZED" }, 401);
    if (error instanceof SyntaxError) return json({ message: "A JSON request body is required", code: "INVALID_BODY" }, 400);
    if (error instanceof Error && /sessionId|threadId|clientMessageId|message|Target intent|title|evidence|action|Unexpected|JSON object/.test(error.message)) return json({ message: error.message, code: "INVALID_BODY" }, 400);
    return json({ message: "Coach could not reply. Try again.", code: "COACH_FAILED" }, 500);
  }
}
import { aiEligibilityErrorResponse } from "../_shared/ai-eligibility.ts";
