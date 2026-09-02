import { reanalyzeVideoHandler } from "./handler";
import { AiEligibilityError } from "../_shared/ai-eligibility";

describe("reanalyzeVideoHandler quota response", () => {
  it("requires current AI consent before inspecting reusable input or reserving quota", async () => {
    const verifyReusableInput = jest.fn();
    const response = await reanalyzeVideoHandler(new Request("https://edge.test", {
      method: "POST", body: JSON.stringify({ sessionId: "session-1" }),
    }), {
      authenticate: async () => { throw new AiEligibilityError("AI_CONSENT_REQUIRED"); },
      canonicalizeDeclaration: async (value) => value,
      verifyReusableInput,
      resetSession: jest.fn(),
      reserveCredit: jest.fn(),
    } as never);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "AI_CONSENT_REQUIRED" });
    expect(verifyReusableInput).not.toHaveBeenCalled();
  });
  it("returns the existing live analysis instead of starting duplicate reanalysis", async () => {
    const resetSession = jest.fn();
    const response = await reanalyzeVideoHandler(new Request("https://edge.test", {
      method: "POST", body: JSON.stringify({ sessionId: "session-1", clientRequestId: "duplicate-request" }),
    }), {
      authenticate: async () => "user-1", canonicalizeDeclaration: async (value) => value,
      verifyReusableInput: async () => "ready", resetSession,
      reserveCredit: async () => ({ reservationId: null, status: "analysis_pending", blockingSessionId: "session-live", remaining: 8, periodEndsAt: "2026-09-01T00:00:00Z" }),
    } as never);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "ANALYSIS_PENDING", sessionId: "session-live", remaining: 8 });
    expect(resetSession).not.toHaveBeenCalled();
  });

  it("returns the authoritative balance after reserving a reanalysis", async () => {
    const response = await reanalyzeVideoHandler(new Request("https://edge.test", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1", clientRequestId: "reanalysis-request-1" }),
    }), {
      authenticate: async () => "user-1",
      canonicalizeDeclaration: async (value) => value,
      verifyReusableInput: async () => "ready",
      resetSession: async () => "ready",
      reserveCredit: async () => ({ reservationId: "reservation-1", remaining: 8, periodEndsAt: "2026-09-01T00:00:00Z" }),
      cancelCredit: async () => undefined,
    });
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ reservationId: "reservation-1", remaining: 8, periodEndsAt: "2026-09-01T00:00:00Z" });
  });
});
