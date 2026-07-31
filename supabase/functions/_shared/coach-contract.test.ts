import { coachMessageSchema, parseCoachCommand } from "./coach-contract";

const sessionId = "11111111-1111-4111-8111-111111111111";
const threadId = "22222222-2222-4222-8222-222222222222";

describe("coach contract", () => {
  it("rejects untrusted identifiers, blank messages, and extra client data", () => {
    expect(() => parseCoachCommand({ action: "send", threadId, sessionId: "not-a-uuid", message: "Check my shoulder position" })).toThrow("A valid sessionId is required");
    expect(() => parseCoachCommand({ action: "send", threadId, sessionId, message: "  " })).toThrow();
    expect(() => parseCoachCommand({ action: "send", threadId, sessionId, message: "Hi", videoPath: "someone/video.mp4" })).toThrow();
  });

  it("parses explicit thread commands and evidence selection", () => {
    expect(parseCoachCommand({ action: "create", sessionId })).toEqual({ action: "create", sessionId });
    expect(parseCoachCommand({ action: "rename", threadId, title: "Fix my rows" })).toEqual({ action: "rename", threadId, title: "Fix my rows" });
    expect(parseCoachCommand({ action: "delete", threadId })).toEqual({ action: "delete", threadId });
    expect(parseCoachCommand({ action: "send", threadId, sessionId, message: "What changes here?", evidence: { findingId: "corr_1", peakMs: 13_333 } })).toEqual({
      action: "send",
      threadId,
      sessionId,
      message: "What changes here?",
      evidence: { findingId: "corr_1", peakMs: 13_333 },
    });
    expect(parseCoachCommand({ action: "send", threadId, sessionId, message: "Retry safely", clientMessageId: "coach-123-abc" })).toMatchObject({ clientMessageId: "coach-123-abc" });
  });

  it("rejects malformed thread commands", () => {
    expect(() => parseCoachCommand({ action: "rename", threadId, title: " " })).toThrow(/title/i);
    expect(() => parseCoachCommand({ action: "delete", threadId: "bad" })).toThrow(/threadId/i);
    expect(() => parseCoachCommand({ action: "send", threadId, sessionId, message: "Question", evidence: { findingId: "corr_1", peakMs: -1 } })).toThrow(/evidence/i);
    expect(() => parseCoachCommand({ action: "send", threadId, sessionId, message: "Question", clientMessageId: "spaces are invalid" })).toThrow(/clientMessageId/i);
  });

  it("keeps saved message roles exact", () => {
    expect(() => coachMessageSchema.parse({ id: "11111111-1111-4111-8111-111111111111", threadId: "22222222-2222-4222-8222-222222222222", role: "system", content: "No", createdAt: "now" })).toThrow();
  });

  it("accepts validated assistant grounding and rejects grounding on user messages", () => {
    const base = { id: "11111111-1111-4111-8111-111111111111", threadId, content: "Answer", createdAt: "now" };
    const grounding = { scope: "focused_window", startMs: 3_500, endMs: 9_500, citations: [{ timeMs: 5_500, label: "Elbow flares." }] };
    expect(coachMessageSchema.parse({ ...base, role: "assistant", grounding })).toMatchObject({ grounding });
    expect(() => coachMessageSchema.parse({ ...base, role: "user", grounding })).toThrow(/grounding/i);
    expect(() => coachMessageSchema.parse({ ...base, role: "assistant", grounding: { ...grounding, citations: [{ timeMs: 10_000, label: "Outside" }] } })).toThrow(/grounding/i);
  });
});
