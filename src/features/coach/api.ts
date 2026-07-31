import { z } from "zod";

import type { CoachConversation, CoachEvidenceAttachment, CoachThread } from "./types";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const citationSchema = z.object({ timeMs: z.number().int().nonnegative(), label: z.string().min(1).max(500) }).strict();
const rangedGroundingSchema = z.object({ scope: z.enum(["whole_set", "focused_window"]), startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(), citations: z.array(citationSchema).max(8) }).strict().superRefine((value, context) => {
  if (value.endMs <= value.startMs) context.addIssue({ code: "custom", message: "Grounding range is invalid" });
  if (value.citations.some((citation) => citation.timeMs < value.startMs || citation.timeMs > value.endMs)) context.addIssue({ code: "custom", message: "Grounding citation is outside the reviewed range" });
});
const insufficientGroundingSchema = z.object({ scope: z.literal("insufficient"), startMs: z.null(), endMs: z.null(), citations: z.tuple([]) }).strict();
const groundingSchema = z.union([rangedGroundingSchema, insufficientGroundingSchema]);
const messageSchema = z.object({ id: z.string().uuid(), threadId: z.string().uuid(), role: z.enum(["user", "assistant"]), content: z.string().min(1), createdAt: z.string(), grounding: groundingSchema.nullish().transform((value) => value ?? null) });
const threadSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid(), sessionId: z.string().uuid(), title: z.string().nullable(), targetIntent: z.string().nullable(), createdAt: z.string(), updatedAt: z.string() });
const conversationSchema = z.object({ thread: threadSchema.nullable(), messages: z.array(messageSchema) });
const threadListSchema = z.object({ threads: z.array(threadSchema) });
const threadResponseSchema = z.object({ thread: threadSchema });
const deleteResponseSchema = z.object({ deletedThreadId: z.string().uuid() });
const sendSchema = z.object({ threadId: z.string().uuid(), userMessage: messageSchema, assistantMessage: messageSchema });

export class CoachApiError extends Error {
  constructor(message: string, readonly status: number, readonly code = "COACH_FAILED") {
    super(message);
    this.name = "CoachApiError";
  }
}

function baseUrl(value?: string) {
  const configured = value ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!configured) throw new CoachApiError("Supabase URL is not configured", 0, "MISSING_CONFIGURATION");
  return configured.endsWith("/functions/v1") ? configured : `${configured.replace(/\/$/, "")}/functions/v1`;
}

function publicApiKey(value?: string) {
  const configured = value ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!configured) throw new CoachApiError("Supabase public API key is not configured", 0, "MISSING_CONFIGURATION");
  return configured;
}

async function request<T>(input: { accessToken: string; apiKey?: string; baseUrl?: string; fetcher?: Fetcher; path: string; init?: RequestInit; schema: z.ZodType<T> }): Promise<T> {
  const response = await (input.fetcher ?? fetch)(`${baseUrl(input.baseUrl)}/${input.path}`, { ...input.init, headers: { apikey: publicApiKey(input.apiKey), Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" } });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new CoachApiError(typeof payload.message === "string" ? payload.message : "Coach request failed", response.status, typeof payload.code === "string" ? payload.code : "COACH_FAILED");
  const parsed = input.schema.safeParse(payload);
  if (!parsed.success) throw new CoachApiError("Coach returned an invalid response", response.status, "INVALID_RESPONSE");
  return parsed.data;
}

export async function listCoachThreads(input: { accessToken: string; apiKey?: string; baseUrl?: string; fetcher?: Fetcher }): Promise<CoachThread[]> {
  return (await request({ ...input, path: "coach-chat", schema: threadListSchema })).threads;
}

export function getCoachConversation(input: { accessToken: string; apiKey?: string; threadId: string; baseUrl?: string; fetcher?: Fetcher }): Promise<CoachConversation> {
  return request({ ...input, path: `coach-chat?threadId=${encodeURIComponent(input.threadId)}`, schema: conversationSchema });
}

export async function createCoachThread(input: { accessToken: string; apiKey?: string; sessionId: string; baseUrl?: string; fetcher?: Fetcher }): Promise<CoachThread> {
  return (await request({ ...input, path: "coach-chat", init: { method: "POST", body: JSON.stringify({ action: "create", sessionId: input.sessionId }) }, schema: threadResponseSchema })).thread;
}

export async function renameCoachThread(input: { accessToken: string; apiKey?: string; threadId: string; title: string; baseUrl?: string; fetcher?: Fetcher }): Promise<CoachThread> {
  return (await request({ ...input, path: "coach-chat", init: { method: "POST", body: JSON.stringify({ action: "rename", threadId: input.threadId, title: input.title.trim() }) }, schema: threadResponseSchema })).thread;
}

export async function deleteCoachThread(input: { accessToken: string; apiKey?: string; threadId: string; baseUrl?: string; fetcher?: Fetcher }): Promise<string> {
  return (await request({ ...input, path: "coach-chat", init: { method: "POST", body: JSON.stringify({ action: "delete", threadId: input.threadId }) }, schema: deleteResponseSchema })).deletedThreadId;
}

export function sendCoachMessage(input: { accessToken: string; apiKey?: string; threadId: string; sessionId: string; message: string; clientMessageId?: string; targetIntent?: string; evidence?: Pick<CoachEvidenceAttachment, "findingId" | "peakMs">; baseUrl?: string; fetcher?: Fetcher }) {
  const body = { action: "send", threadId: input.threadId, sessionId: input.sessionId, message: input.message, ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}), ...(input.targetIntent?.trim() ? { targetIntent: input.targetIntent.trim() } : {}), ...(input.evidence ? { evidence: input.evidence } : {}) };
  return request({ ...input, path: "coach-chat", init: { method: "POST", body: JSON.stringify(body) }, schema: sendSchema });
}
