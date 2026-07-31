import { CoachApiError, createCoachThread, deleteCoachThread, getCoachConversation, listCoachThreads, renameCoachThread, sendCoachMessage } from "./api";

const sessionId = "11111111-1111-4111-8111-111111111111";
const threadId = "22222222-2222-4222-8222-222222222222";
const userId = "99999999-9999-4999-8999-999999999999";
const thread = { id: threadId, userId, sessionId, title: null, targetIntent: null, createdAt: "2026-07-22T00:00:00Z", updatedAt: "2026-07-22T00:00:00Z" };

describe("Coach API", () => {
  it("lists and loads conversations with bearer auth", async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ threads: [thread] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ thread, messages: [] }), { status: 200 }));
    await expect(listCoachThreads({ accessToken: "user-jwt", apiKey: "public-key", baseUrl: "https://example/functions/v1", fetcher })).resolves.toEqual([thread]);
    await getCoachConversation({ accessToken: "user-jwt", apiKey: "public-key", threadId, baseUrl: "https://example/functions/v1", fetcher });
    expect(fetcher).toHaveBeenNthCalledWith(1, "https://example/functions/v1/coach-chat", expect.objectContaining({ headers: expect.objectContaining({ apikey: "public-key", Authorization: "Bearer user-jwt" }) }));
    expect(fetcher).toHaveBeenNthCalledWith(2, `https://example/functions/v1/coach-chat?threadId=${encodeURIComponent(threadId)}`, expect.anything());
  });

  it("creates, renames, and deletes explicit threads", async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ thread }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ thread: { ...thread, title: "Row questions" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ deletedThreadId: threadId }), { status: 200 }));
    await createCoachThread({ accessToken: "jwt", apiKey: "public-key", sessionId, baseUrl: "https://example", fetcher });
    await renameCoachThread({ accessToken: "jwt", apiKey: "public-key", threadId, title: "Row questions", baseUrl: "https://example", fetcher });
    await deleteCoachThread({ accessToken: "jwt", apiKey: "public-key", threadId, baseUrl: "https://example", fetcher });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ action: "create", sessionId });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ action: "rename", threadId, title: "Row questions" });
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ action: "delete", threadId });
  });

  it("posts the selected thread, question, intent, and evidence", async () => {
    const grounding = { scope: "focused_window", startMs: 3_500, endMs: 9_500, citations: [{ timeMs: 5_500, label: "The right shoulder rises." }] };
    const response = { threadId, userMessage: { id: "33333333-3333-4333-8333-333333333333", threadId, role: "user", content: "Am I keeping my shoulders level?", createdAt: "now", grounding: null }, assistantMessage: { id: "44444444-4444-4444-8444-444444444444", threadId, role: "assistant", content: "Yes", createdAt: "now", grounding } };
    const fetcher = jest.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    await expect(sendCoachMessage({ accessToken: "user-jwt", apiKey: "public-key", threadId, sessionId, message: "Am I keeping my shoulders level?", clientMessageId: "coach-123-abc", targetIntent: "upper back", evidence: { findingId: "corr_1", peakMs: 13_333 }, baseUrl: "https://example/functions/v1", fetcher })).resolves.toMatchObject({ assistantMessage: { grounding } });
    expect(fetcher).toHaveBeenCalledWith("https://example/functions/v1/coach-chat", expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "send", threadId, sessionId, message: "Am I keeping my shoulders level?", clientMessageId: "coach-123-abc", targetIntent: "upper back", evidence: { findingId: "corr_1", peakMs: 13_333 } }) }));
  });

  it("rejects malformed grounding from the server", async () => {
    const response = { threadId, userMessage: { id: "33333333-3333-4333-8333-333333333333", threadId, role: "user", content: "Question", createdAt: "now" }, assistantMessage: { id: "44444444-4444-4444-8444-444444444444", threadId, role: "assistant", content: "Answer", createdAt: "now", grounding: { scope: "focused_window", startMs: 5_000, endMs: 4_000, citations: [] } } };
    const fetcher = jest.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    await expect(sendCoachMessage({ accessToken: "jwt", apiKey: "public-key", threadId, sessionId, message: "Question", baseUrl: "https://example", fetcher })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("exposes typed server failures", async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({ message: "Video unavailable", code: "VIDEO_NOT_FOUND" }), { status: 409 }));
    await expect(getCoachConversation({ accessToken: "jwt", apiKey: "public-key", threadId, fetcher, baseUrl: "https://example" })).rejects.toMatchObject<Partial<CoachApiError>>({ status: 409, code: "VIDEO_NOT_FOUND" });
  });
});
