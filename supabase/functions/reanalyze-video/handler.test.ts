import { reanalyzeVideoHandler, type ReanalyzeVideoDependencies } from "./handler";
import type { SetDeclaration } from "../_shared/set-declaration";

const declaration: SetDeclaration = {
  exercise: { source: "custom", catalogExerciseId: null, label: "Flat dumbbell bench press" },
  amount: { kind: "reps", value: 8, countScope: "total" },
  load: { kind: "known", value: 40, unit: "lb", scope: "per_hand" },
  side: null,
  styles: [],
  focusNote: null,
};

function request(body: unknown = { sessionId: "session-1" }) {
  return new Request("https://example.test/reanalyze-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(outcome: "ready" | "not_found" | "video_missing" | "busy" | "declaration_required" = "ready"): ReanalyzeVideoDependencies & {
  verifyReusableInput: jest.Mock<Promise<"ready" | "not_found" | "video_missing">, [string, string]>;
} {
  return {
    authenticate: jest.fn(async () => "user-1"),
    canonicalizeDeclaration: jest.fn(async (value) => value),
    verifyReusableInput: jest.fn(async () => "ready"),
    resetSession: jest.fn(async () => outcome),
  };
}

describe("reanalyzeVideoHandler", () => {
  it("resets an owned saved video for the existing analysis pipeline", async () => {
    const deps = dependencies();
    const response = await reanalyzeVideoHandler(request(), deps);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ sessionId: "session-1", status: "queued", stage: "video_check" });
    expect(deps.resetSession).toHaveBeenCalledWith("session-1", "user-1", undefined);
  });

  it("validates and applies a corrected declaration to the same uploaded session", async () => {
    const deps = dependencies();
    const response = await reanalyzeVideoHandler(request({ sessionId: "session-1", declaration }), deps);

    expect(response.status).toBe(202);
    expect(deps.canonicalizeDeclaration).toHaveBeenCalledWith(declaration);
    expect(deps.resetSession).toHaveBeenCalledWith("session-1", "user-1", declaration);
  });

  it.each([
    ["not_found", 404, "NOT_FOUND"],
    ["video_missing", 409, "VIDEO_NOT_FOUND"],
    ["busy", 409, "ALREADY_PROCESSING"],
    ["declaration_required", 409, "SET_DECLARATION_REQUIRED"],
  ] as const)("maps %s reset outcomes", async (outcome, expectedStatus, expectedCode) => {
    const response = await reanalyzeVideoHandler(request(), dependencies(outcome));
    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toMatchObject({ code: expectedCode });
  });

  it("requires authentication and an exact sessionId body", async () => {
    const unauthorized = dependencies();
    unauthorized.authenticate = jest.fn(async () => { throw new Error("UNAUTHORIZED"); });
    expect((await reanalyzeVideoHandler(request(), unauthorized)).status).toBe(401);

    const extraField = await reanalyzeVideoHandler(request({ sessionId: "session-1", preserveResult: true }), dependencies());
    expect(extraField.status).toBe(400);
    expect((await reanalyzeVideoHandler(request({ sessionId: "session-1", declaration: { exercise: null } }), dependencies())).status).toBe(400);
  });

  it("keeps the old result available when the atomic reset fails", async () => {
    const deps = dependencies();
    deps.resetSession = jest.fn(async () => { throw new Error("database unavailable"); });
    const response = await reanalyzeVideoHandler(request(), deps);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: "REANALYZE_FAILED" });
  });

  it("does not clear the saved result when the retained input is stale", async () => {
    const deps = dependencies();
    deps.verifyReusableInput.mockResolvedValue("video_missing");

    const response = await reanalyzeVideoHandler(request(), deps);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "VIDEO_NOT_FOUND" });
    expect(deps.resetSession).not.toHaveBeenCalled();
  });
});
