import { analyzeVideoV49Handler } from "./handler";
import { AiEligibilityError } from "../_shared/ai-eligibility";

it("returns AI_CONSENT_REQUIRED before loading or executing a run", async () => {
  const loadRun = jest.fn();
  const execute = jest.fn();
  const response = await analyzeVideoV49Handler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ sessionId: "session-1" }) }), {
    authenticate: async () => { throw new AiEligibilityError("AI_CONSENT_REQUIRED"); },
    loadRun,
    execute,
  });
  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ code: "AI_CONSENT_REQUIRED" });
  expect(loadRun).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
});

it("rejects a caller-supplied shadow run without shadow authorization", async () => {
  const response = await analyzeVideoV49Handler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ sessionId: "session-1", runId: "shadow-1" }) }), {
    authenticate: async () => ({ userId: "user-1", allowShadow: false }),
    loadRun: jest.fn(),
    execute: jest.fn(),
  });
  expect(response.status).toBe(403);
});

it("executes the active primary run for a normal session request", async () => {
  const execute = jest.fn(async () => ({ status: "complete", stage: "complete", result: { status: "complete" } }));
  const response = await analyzeVideoV49Handler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ sessionId: "session-1" }) }), {
    authenticate: async () => ({ userId: "user-1", allowShadow: false }),
    loadRun: async () => ({ runId: "run-1", sessionId: "session-1", userId: "user-1", mode: "primary" }),
    execute,
  });
  expect(response.status).toBe(200);
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ runId: "run-1" }));
});
