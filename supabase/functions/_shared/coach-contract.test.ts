import { coachMessageSchema, parseCoachRequest } from "./coach-contract";

describe("coach contract", () => {
  it("rejects untrusted identifiers, blank messages, and extra client data", () => {
    expect(() => parseCoachRequest({ sessionId: "not-a-uuid", message: "Check my shoulder position" })).toThrow("A valid sessionId is required");
    expect(() => parseCoachRequest({ sessionId: "11111111-1111-4111-8111-111111111111", message: "  " })).toThrow();
    expect(() => parseCoachRequest({ sessionId: "11111111-1111-4111-8111-111111111111", message: "Hi", videoPath: "someone/video.mp4" })).toThrow();
  });

  it("keeps saved message roles exact", () => {
    expect(() => coachMessageSchema.parse({ id: "11111111-1111-4111-8111-111111111111", threadId: "22222222-2222-4222-8222-222222222222", role: "system", content: "No", createdAt: "now" })).toThrow();
  });
});
