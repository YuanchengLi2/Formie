import { cancelAnalysisHandler } from "./handler";

describe("cancel analysis handler", () => {
  it("cancels only the authenticated user's reservation", async () => {
    const cancel = jest.fn(async () => ({ cancelled: true, access: { status: "active", remaining: 9, period_ends_at: "2026-09-01T00:00:00Z" } }));
    const response = await cancelAnalysisHandler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ reservationId: "r-1" }) }), { authenticate: async () => "user-1", cancel });
    expect(response.status).toBe(200);
    expect(cancel).toHaveBeenCalledWith("user-1", { reservationId: "r-1", sessionId: undefined });
    await expect(response.json()).resolves.toMatchObject({ cancelled: true, access: { remaining: 9 } });
  });
});
