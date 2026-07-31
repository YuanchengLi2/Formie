import type { CoachGrounding } from "./coach-analysis.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CoachEvidenceSelection = { findingId: string; peakMs: number };
export type CoachRequest = { action: "send"; threadId: string; sessionId: string; message: string; clientMessageId?: string; targetIntent?: string; evidence?: CoachEvidenceSelection };
export type CoachCommand =
  | CoachRequest
  | { action: "create"; sessionId: string }
  | { action: "rename"; threadId: string; title: string }
  | { action: "delete"; threadId: string };
export type CoachMessage = { id: string; threadId: string; role: "user" | "assistant"; content: string; createdAt: string; grounding: CoachGrounding | null };

function parseGrounding(input: unknown): CoachGrounding {
  const value = record(input);
  exactKeys(value, ["scope", "startMs", "endMs", "citations"]);
  if (value.scope !== "whole_set" && value.scope !== "focused_window" && value.scope !== "insufficient") throw new Error("Coach grounding scope is invalid");
  if (!Array.isArray(value.citations) || value.citations.length > 8) throw new Error("Coach grounding citations are invalid");
  const citations = value.citations.map((item) => {
    const citation = record(item);
    exactKeys(citation, ["timeMs", "label"]);
    if (!Number.isInteger(citation.timeMs) || Number(citation.timeMs) < 0 || typeof citation.label !== "string" || !citation.label.trim() || citation.label.trim().length > 500) throw new Error("Coach grounding citation is invalid");
    return { timeMs: Number(citation.timeMs), label: citation.label.trim() };
  });
  if (value.scope === "insufficient") {
    if (value.startMs !== null || value.endMs !== null || citations.length) throw new Error("Coach grounding is invalid for insufficient evidence");
    return { scope: value.scope, startMs: null, endMs: null, citations };
  }
  if (!Number.isInteger(value.startMs) || !Number.isInteger(value.endMs) || Number(value.startMs) < 0 || Number(value.endMs) <= Number(value.startMs)) throw new Error("Coach grounding range is invalid");
  if (citations.some((citation) => citation.timeMs < Number(value.startMs) || citation.timeMs > Number(value.endMs))) throw new Error("Coach grounding citation is outside the reviewed range");
  return { scope: value.scope, startMs: Number(value.startMs), endMs: Number(value.endMs), citations };
}

export const coachMessageSchema = {
  parse(input: unknown): CoachMessage {
    if (!input || typeof input !== "object") throw new Error("Invalid coach message");
    const value = input as Record<string, unknown>;
    if (!UUID.test(String(value.id)) || !UUID.test(String(value.threadId))) throw new Error("Invalid coach message id");
    if (value.role !== "user" && value.role !== "assistant") throw new Error("Invalid coach message role");
    if (typeof value.content !== "string" || !value.content.trim() || value.content.length > 8000 || typeof value.createdAt !== "string") throw new Error("Invalid coach message");
    if (value.role === "user" && value.grounding !== undefined && value.grounding !== null) throw new Error("User messages cannot include coach grounding");
    const grounding = value.role === "assistant" && value.grounding !== undefined && value.grounding !== null ? parseGrounding(value.grounding) : null;
    return { id: String(value.id), threadId: String(value.threadId), role: value.role, content: value.content, createdAt: value.createdAt, grounding };
  },
};

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("A JSON object is required");
  return input as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("Unexpected coach request field");
}

export function parseCoachCommand(input: unknown): CoachCommand {
  const value = record(input);
  if (value.action === "create") {
    exactKeys(value, ["action", "sessionId"]);
    return { action: "create", sessionId: parseCoachSessionId(value.sessionId) };
  }
  if (value.action === "rename") {
    exactKeys(value, ["action", "threadId", "title"]);
    const title = typeof value.title === "string" ? value.title.trim() : "";
    if (!title || title.length > 120) throw new Error("Thread title is invalid");
    return { action: "rename", threadId: parseCoachThreadId(value.threadId), title };
  }
  if (value.action === "delete") {
    exactKeys(value, ["action", "threadId"]);
    return { action: "delete", threadId: parseCoachThreadId(value.threadId) };
  }
  if (value.action !== "send") throw new Error("Coach action is invalid");
  exactKeys(value, ["action", "threadId", "sessionId", "message", "clientMessageId", "targetIntent", "evidence"]);
  const sessionId = parseCoachSessionId(value.sessionId);
  const threadId = parseCoachThreadId(value.threadId);
  if (typeof value.message !== "string" || !value.message.trim()) throw new Error("A message is required");
  if (value.message.trim().length > 2000) throw new Error("Message is too long");
  if (value.clientMessageId !== undefined && (typeof value.clientMessageId !== "string" || !/^[A-Za-z0-9_-]{8,120}$/.test(value.clientMessageId))) throw new Error("clientMessageId is invalid");
  if (value.targetIntent !== undefined && (typeof value.targetIntent !== "string" || !value.targetIntent.trim() || value.targetIntent.trim().length > 240)) throw new Error("Target intent is invalid");
  let evidence: CoachEvidenceSelection | undefined;
  if (value.evidence !== undefined) {
    const selected = record(value.evidence);
    exactKeys(selected, ["findingId", "peakMs"]);
    if (typeof selected.findingId !== "string" || !selected.findingId.trim() || selected.findingId.trim().length > 160 || !Number.isInteger(selected.peakMs) || Number(selected.peakMs) < 0) throw new Error("Selected evidence is invalid");
    evidence = { findingId: selected.findingId.trim(), peakMs: Number(selected.peakMs) };
  }
  return { action: "send", threadId, sessionId, message: value.message.trim(), ...(typeof value.clientMessageId === "string" ? { clientMessageId: value.clientMessageId } : {}), ...(typeof value.targetIntent === "string" ? { targetIntent: value.targetIntent.trim() } : {}), ...(evidence ? { evidence } : {}) };
}

export function parseCoachRequest(input: unknown): CoachRequest {
  const parsed = parseCoachCommand(input);
  if (parsed.action !== "send") throw new Error("A send action is required");
  return parsed;
}

export function parseCoachSessionId(input: unknown): string {
  if (typeof input !== "string" || !UUID.test(input)) throw new Error("A valid sessionId is required");
  return input;
}

export function parseCoachThreadId(input: unknown): string {
  if (typeof input !== "string" || !UUID.test(input)) throw new Error("A valid threadId is required");
  return input;
}
