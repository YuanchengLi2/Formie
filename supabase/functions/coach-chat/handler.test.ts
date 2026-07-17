import { coachChatHandler, type CoachChatDependencies } from "./handler";

const sessionId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const threadId = "33333333-3333-4333-8333-333333333333";
const message = (role: "user" | "assistant", content: string, id = "44444444-4444-4444-8444-444444444444") => ({ id, threadId, role, content, createdAt: "2026-07-16T00:00:00Z" });

function dependencies(overrides: Partial<CoachChatDependencies> = {}): CoachChatDependencies {
  const thread = { id: threadId, userId, sessionId, targetIntent: null, geminiFileName: null, geminiFileUri: null, geminiFileState: null };
  return {
    authenticate: jest.fn(async () => userId),
    loadSession: jest.fn(async () => ({ id: sessionId, userId, status: "complete", videoPath: `${userId}/${sessionId}/original.mp4`, result: { score: 82, setContext: { cameraView: "front", visibleReferences: ["shoulders"], sequenceSummary: "Eight reps were visible.", changeAcrossSet: "The same path continued.", coachingBasis: "Preserve that path." }, repTimeline: [{ repNumber: 1, assessment: "consistent" }] } })),
    loadThread: jest.fn(async () => thread),
    createThread: jest.fn(async () => thread),
    updateTargetIntent: jest.fn(async () => undefined),
    loadMessages: jest.fn(async () => []),
    insertMessage: jest.fn(async (_thread, _user, role, content) => message(role, content, role === "user" ? "44444444-4444-4444-8444-444444444444" : "55555555-5555-4555-8555-555555555555")),
    ensureVideoFile: jest.fn(async () => ({ name: "files/video", uri: "gemini://video", mimeType: "video/mp4", state: "ACTIVE" })),
    generateReply: jest.fn(async () => "At 00:01, keep your shoulders level."),
    ...overrides,
  };
}

describe("coach chat handler", () => {
  it("requires authentication and returns empty owned history", async () => {
    const unauthorized = dependencies({ authenticate: jest.fn(async () => { throw new Error("UNAUTHORIZED"); }) });
    expect((await coachChatHandler(new Request(`https://example/coach-chat?sessionId=${sessionId}`), unauthorized)).status).toBe(401);
    const deps = dependencies({ loadThread: jest.fn(async () => null) });
    await expect((await coachChatHandler(new Request(`https://example/coach-chat?sessionId=${sessionId}`), deps)).json()).resolves.toEqual({ thread: null, messages: [] });
  });

  it("persists the user first, grounds generation, then saves the assistant", async () => {
    const deps = dependencies();
    const response = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, message: "Check my shoulder position", targetIntent: "upper back" }) }), deps);
    expect(response.status).toBe(200);
    expect(deps.insertMessage).toHaveBeenNthCalledWith(1, threadId, userId, "user", "Check my shoulder position");
    expect(deps.generateReply).toHaveBeenCalledWith(expect.objectContaining({ videoFile: expect.objectContaining({ state: "ACTIVE" }), analysis: expect.objectContaining({ score: 82, setContext: expect.objectContaining({ sequenceSummary: "Eight reps were visible." }), repTimeline: [expect.objectContaining({ repNumber: 1 })] }), prompt: expect.stringContaining("Eight reps were visible."), history: expect.arrayContaining([expect.objectContaining({ role: "user" })]) }));
    expect(deps.insertMessage).toHaveBeenNthCalledWith(2, threadId, userId, "assistant", expect.stringContaining("00:01"));
  });

  it("does not persist a fake assistant message when the model fails", async () => {
    const deps = dependencies({ generateReply: jest.fn(async () => { throw new Error("model down"); }) });
    const response = await coachChatHandler(new Request("https://example/coach-chat", { method: "POST", body: JSON.stringify({ sessionId, message: "Help" }) }), deps);
    expect(response.status).toBe(500);
    expect(deps.insertMessage).toHaveBeenCalledTimes(1);
  });
});
