import { coachChatHandler, type CoachChatDependencies } from "./handler";

const sessionId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const threadId = "33333333-3333-4333-8333-333333333333";
const otherThreadId = "66666666-6666-4666-8666-666666666666";
const message = (role: "user" | "assistant", content: string, id = "44444444-4444-4444-8444-444444444444", grounding: Record<string, unknown> | null = null) => ({ id, threadId, role, content, createdAt: "2026-07-16T00:00:00Z", grounding });

function dependencies(overrides: Partial<CoachChatDependencies> = {}): CoachChatDependencies {
  const thread = { id: threadId, userId, sessionId, title: null, targetIntent: null, geminiFileName: null, geminiFileUri: null, geminiFileState: null, createdAt: "2026-07-16T00:00:00Z", updatedAt: "2026-07-16T00:00:00Z" };
  return {
    authenticate: jest.fn(async () => userId),
    loadSession: jest.fn(async () => ({ id: sessionId, userId, status: "complete", durationMs: 20_000, videoPath: `${userId}/${sessionId}/original.mp4`, geminiFileName: null, geminiFileUri: null, geminiFileState: null, result: { score: 82, setContext: { cameraView: "front", visibleReferences: ["shoulders"], sequenceSummary: "Eight reps were visible.", changeAcrossSet: "The same path continued.", coachingBasis: "Preserve that path." }, repTimeline: [{ repNumber: 1, assessment: "consistent" }], priorityCorrections: [{ id: "corr_1", title: "Level your shoulders", detail: "The right shoulder rises.", evidence: [{ peakMs: 1300, repNumber: 1, phase: "top", visualEvidence: "The right shoulder is visibly higher." }] }] } })),
    listThreads: jest.fn(async () => [thread]),
    loadThread: jest.fn(async () => thread),
    createThread: jest.fn(async () => thread),
    renameThread: jest.fn(async (_threadId, _userId, title) => ({ ...thread, title })),
    deleteThread: jest.fn(async () => true),
    updateTargetIntent: jest.fn(async () => undefined),
    loadMessages: jest.fn(async () => []),
    loadExchange: jest.fn(async () => null),
    ensureVideoFile: jest.fn(async () => ({ name: "files/video", uri: "gemini://video", mimeType: "video/mp4", state: "ACTIVE" })),
    locateQuestion: jest.fn(async () => ({ scope: "focused_window", startMs: 5_000, endMs: 8_000, rationale: "Rep four", clarification: null })),
    answerQuestion: jest.fn(async () => ({ directAnswer: "Your right shoulder rises.", observations: [{ offsetMs: 2_000, label: "The right shoulder is visibly higher." }], visibilityLimitations: [], nextSetAction: "Keep both shoulders level." })),
    appendExchange: jest.fn(async (_thread, _user, _exchangeKey, userContent, assistantContent, grounding) => ({
      userMessage: message("user", userContent),
      assistantMessage: message("assistant", assistantContent, "55555555-5555-4555-8555-555555555555", grounding as Record<string, unknown>),
    })),
    ...overrides,
  };
}

describe("coach chat handler", () => {
  it("requires authentication and returns empty owned history", async () => {
    const unauthorized = dependencies({ authenticate: jest.fn(async () => { throw new Error("UNAUTHORIZED"); }) });
    expect((await coachChatHandler(new Request("https://example/coach-chat"), unauthorized)).status).toBe(401);
    const deps = dependencies({ listThreads: jest.fn(async () => []) });
    await expect((await coachChatHandler(new Request("https://example/coach-chat"), deps)).json()).resolves.toEqual({ threads: [] });
  });

  it("lists threads and loads one conversation by explicit thread id", async () => {
    const deps = dependencies();
    const listed = await (await coachChatHandler(new Request("https://example/coach-chat"), deps)).json();
    expect(listed).toEqual({ threads: [expect.objectContaining({ id: threadId, sessionId })] });
    expect(listed.threads[0].geminiFileUri).toBeUndefined();
    const loaded = await (await coachChatHandler(new Request(`https://example/coach-chat?threadId=${threadId}`), deps)).json();
    expect(loaded).toEqual({ thread: expect.objectContaining({ id: threadId }), messages: [] });
    expect(loaded.thread.geminiFileName).toBeUndefined();
  });

  it("creates separate threads for the same recording", async () => {
    const createThread = jest.fn()
      .mockResolvedValueOnce(dependencies().loadThread(threadId, userId))
      .mockResolvedValueOnce({ ...(await dependencies().loadThread(threadId, userId)), id: otherThreadId });
    const deps = dependencies({ createThread });
    const request = () => new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ action: "create", sessionId }) });
    expect((await coachChatHandler(request(), deps)).status).toBe(201);
    expect((await coachChatHandler(request(), deps)).status).toBe(201);
    expect(createThread).toHaveBeenCalledTimes(2);
  });

  it("renames and deletes only the selected owned thread", async () => {
    const deps = dependencies();
    const renamed = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ action: "rename", threadId, title: "Row questions" }) }), deps);
    expect(renamed.status).toBe(200);
    expect(deps.renameThread).toHaveBeenCalledWith(threadId, userId, "Row questions");
    const deleted = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ action: "delete", threadId }) }), deps);
    expect(deleted.status).toBe(200);
    expect(deps.deleteThread).toHaveBeenCalledWith(threadId, userId);
  });

  it("locates, analyzes the focused clip, then atomically saves the grounded exchange", async () => {
    const deps = dependencies();
    const response = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", threadId, sessionId, message: "Check my shoulder position", targetIntent: "upper back" }) }), deps);
    expect(response.status).toBe(200);
    expect(deps.locateQuestion).toHaveBeenCalledWith(expect.objectContaining({ videoFile: expect.objectContaining({ state: "ACTIVE" }), prompt: expect.stringContaining("Check my shoulder position") }));
    expect(deps.answerQuestion).toHaveBeenCalledWith(expect.objectContaining({ window: { startMs: 3_500, endMs: 9_500 }, prompt: expect.stringContaining("may make a new visible observation") }));
    expect(deps.appendExchange).toHaveBeenCalledWith(threadId, userId, expect.any(String), "Check my shoulder position", expect.stringContaining("00:05.5"), expect.objectContaining({ scope: "focused_window", citations: [{ timeMs: 5_500, label: "The right shoulder is visibly higher." }] }));
    const payload = await response.json();
    expect(payload.assistantMessage.grounding).toMatchObject({ startMs: 3_500, endMs: 9_500 });
  });

  it("persists nothing when either model stage fails", async () => {
    const deps = dependencies({ answerQuestion: jest.fn(async () => { throw new Error("model down"); }) });
    const response = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ action: "send", threadId, sessionId, message: "Help" }) }), deps);
    expect(response.status).toBe(500);
    expect(deps.appendExchange).not.toHaveBeenCalled();
  });

  it("rejects a thread that belongs to another recording before persistence", async () => {
    const deps = dependencies({ loadThread: jest.fn(async () => ({ ...(await dependencies().loadThread(threadId, userId)), sessionId: "77777777-7777-4777-8777-777777777777" })) });
    const response = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ action: "send", threadId, sessionId, message: "Help" }) }), deps);
    expect(response.status).toBe(409);
    expect(deps.appendExchange).not.toHaveBeenCalled();
  });

  it("resolves selected evidence before generation and rejects fabricated markers", async () => {
    const deps = dependencies();
    const valid = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ action: "send", threadId, sessionId, message: "What happens here?", evidence: { findingId: "corr_1", peakMs: 1300 } }) }), deps);
    expect(valid.status).toBe(200);
    expect(deps.locateQuestion).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining("Level your shoulders") }));

    const invalidDeps = dependencies();
    const invalid = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ action: "send", threadId, sessionId, message: "What happens here?", evidence: { findingId: "corr_1", peakMs: 99 } }) }), invalidDeps);
    expect(invalid.status).toBe(400);
    expect(invalidDeps.appendExchange).not.toHaveBeenCalled();
    expect(invalidDeps.locateQuestion).not.toHaveBeenCalled();
  });

  it("asks for clarification without running the answer stage", async () => {
    const deps = dependencies({ locateQuestion: jest.fn(async () => ({ scope: "insufficient", startMs: null, endMs: null, rationale: "Ambiguous reference", clarification: "Which repetition do you mean?" })) });
    const response = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ action: "send", threadId, sessionId, message: "Did that look right?" }) }), deps);
    expect(response.status).toBe(200);
    expect(deps.answerQuestion).not.toHaveBeenCalled();
    expect(deps.appendExchange).toHaveBeenCalledWith(threadId, userId, expect.any(String), "Did that look right?", "Which repetition do you mean?", { scope: "insufficient", startMs: null, endMs: null, citations: [] });
  });

  it("returns an existing exchange for a retried client message without invoking Gemini", async () => {
    const exchange = {
      userMessage: message("user", "Check rep four"),
      assistantMessage: message("assistant", "Already answered", "55555555-5555-4555-8555-555555555555", { scope: "whole_set", startMs: 0, endMs: 20_000, citations: [] }),
    };
    const deps = dependencies({ loadExchange: jest.fn(async () => exchange) });
    const response = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ action: "send", threadId, sessionId, message: "Check rep four", clientMessageId: "coach-retry-123" }) }), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ threadId, assistantMessage: { content: "Already answered" } });
    expect(deps.ensureVideoFile).not.toHaveBeenCalled();
    expect(deps.locateQuestion).not.toHaveBeenCalled();
    expect(deps.appendExchange).not.toHaveBeenCalled();
  });
});
