import { CoachApiError, getCoachConversation, sendCoachMessage } from "./api";

const sessionId = "11111111-1111-4111-8111-111111111111";

describe("Coach API", () => {
  it("loads an encoded conversation with bearer auth", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ thread: null, messages: [] }), { status: 200 }));
    await getCoachConversation({ accessToken: "user-jwt", sessionId, baseUrl: "https://example/functions/v1", fetcher });
    expect(fetcher).toHaveBeenCalledWith(`https://example/functions/v1/coach-chat?sessionId=${encodeURIComponent(sessionId)}`, expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer user-jwt" }) }));
  });

  it("posts the selected video, question, and optional target intent", async () => {
    const response = { threadId: "22222222-2222-4222-8222-222222222222", userMessage: { id: "33333333-3333-4333-8333-333333333333", threadId: "22222222-2222-4222-8222-222222222222", role: "user", content: "Am I keeping my shoulders level?", createdAt: "now" }, assistantMessage: { id: "44444444-4444-4444-8444-444444444444", threadId: "22222222-2222-4222-8222-222222222222", role: "assistant", content: "Yes", createdAt: "now" } };
    const fetcher = jest.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    await sendCoachMessage({ accessToken: "user-jwt", sessionId, message: "Am I keeping my shoulders level?", targetIntent: "upper back", baseUrl: "https://example/functions/v1", fetcher });
    expect(fetcher).toHaveBeenCalledWith("https://example/functions/v1/coach-chat", expect.objectContaining({ method: "POST", body: JSON.stringify({ sessionId, message: "Am I keeping my shoulders level?", targetIntent: "upper back" }) }));
  });

  it("exposes typed server failures", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ message: "Video unavailable", code: "VIDEO_NOT_FOUND" }), { status: 409 }));
    await expect(getCoachConversation({ accessToken: "jwt", sessionId, fetcher, baseUrl: "https://example" })).rejects.toMatchObject<Partial<CoachApiError>>({ status: 409, code: "VIDEO_NOT_FOUND" });
  });
});
