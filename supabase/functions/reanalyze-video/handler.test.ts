import { reanalyzeVideoHandler } from "./handler";

describe("reanalyzeVideoHandler quota response", () => {
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
