const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CoachRequest = { sessionId: string; message: string; targetIntent?: string };
export type CoachMessage = { id: string; threadId: string; role: "user" | "assistant"; content: string; createdAt: string };

export const coachMessageSchema = {
  parse(input: unknown): CoachMessage {
    if (!input || typeof input !== "object") throw new Error("Invalid coach message");
    const value = input as Record<string, unknown>;
    if (!UUID.test(String(value.id)) || !UUID.test(String(value.threadId))) throw new Error("Invalid coach message id");
    if (value.role !== "user" && value.role !== "assistant") throw new Error("Invalid coach message role");
    if (typeof value.content !== "string" || !value.content.trim() || value.content.length > 8000 || typeof value.createdAt !== "string") throw new Error("Invalid coach message");
    return value as CoachMessage;
  },
};

export function parseCoachRequest(input: unknown): CoachRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("A JSON object is required");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["sessionId", "message", "targetIntent"].includes(key))) throw new Error("Unexpected coach request field");
  const sessionId = parseCoachSessionId(value.sessionId);
  if (typeof value.message !== "string" || !value.message.trim()) throw new Error("A message is required");
  if (value.message.trim().length > 2000) throw new Error("Message is too long");
  if (value.targetIntent !== undefined && (typeof value.targetIntent !== "string" || !value.targetIntent.trim() || value.targetIntent.trim().length > 240)) throw new Error("Target intent is invalid");
  return { sessionId, message: value.message.trim(), ...(typeof value.targetIntent === "string" ? { targetIntent: value.targetIntent.trim() } : {}) };
}

export function parseCoachSessionId(input: unknown): string {
  if (typeof input !== "string" || !UUID.test(input)) throw new Error("A valid sessionId is required");
  return input;
}
