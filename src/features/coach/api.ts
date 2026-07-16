import { z } from "zod";

import type { CoachConversation } from "./types";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const messageSchema = z.object({ id: z.string().uuid(), threadId: z.string().uuid(), role: z.enum(["user", "assistant"]), content: z.string().min(1), createdAt: z.string() });
const threadSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid(), sessionId: z.string().uuid(), targetIntent: z.string().nullable() }).passthrough();
const conversationSchema = z.object({ thread: threadSchema.nullable(), messages: z.array(messageSchema) });
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

async function request<T>(input: { accessToken: string; baseUrl?: string; fetcher?: Fetcher; path: string; init?: RequestInit; schema: z.ZodType<T> }): Promise<T> {
  const response = await (input.fetcher ?? fetch)(`${baseUrl(input.baseUrl)}/${input.path}`, { ...input.init, headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" } });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new CoachApiError(typeof payload.message === "string" ? payload.message : "Coach request failed", response.status, typeof payload.code === "string" ? payload.code : "COACH_FAILED");
  const parsed = input.schema.safeParse(payload);
  if (!parsed.success) throw new CoachApiError("Coach returned an invalid response", response.status, "INVALID_RESPONSE");
  return parsed.data;
}

export function getCoachConversation(input: { accessToken: string; sessionId: string; baseUrl?: string; fetcher?: Fetcher }): Promise<CoachConversation> {
  return request({ ...input, path: `coach-chat?sessionId=${encodeURIComponent(input.sessionId)}`, schema: conversationSchema });
}

export function sendCoachMessage(input: { accessToken: string; sessionId: string; message: string; targetIntent?: string; baseUrl?: string; fetcher?: Fetcher }) {
  const body = { sessionId: input.sessionId, message: input.message, ...(input.targetIntent?.trim() ? { targetIntent: input.targetIntent.trim() } : {}) };
  return request({ ...input, path: "coach-chat", init: { method: "POST", body: JSON.stringify(body) }, schema: sendSchema });
}
