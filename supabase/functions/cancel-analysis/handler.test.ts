import { cancelAnalysisHandler } from "./handler";

describe("cancel analysis handler", () => {
  it("cancels only the authenticated user's reservation", async () => {
    const cancel = jest.fn(async () => ({ cancelled: true, sessionFailed: false, reservationCancelled: true, access: { status: "active", remaining: 9, period_ends_at: "2026-09-01T00:00:00Z" } }));
    const response = await cancelAnalysisHandler(new Request("https://example.test", { method: "POST", body: JSON.stringify({ reservationId: "r-1" }) }), { authenticate: async () => "user-1", cancel });
    expect(response.status).toBe(200);
    expect(cancel).toHaveBeenCalledWith("user-1", { reservationId: "r-1", sessionId: undefined, reason: undefined });
    await expect(response.json()).resolves.toMatchObject({ cancelled: true, access: { remaining: 9 } });
  });

  it("requires a session for a new upload failure cancellation", async () => {
    const cancel = jest.fn();
    const response = await cancelAnalysisHandler(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ reservationId: "r-1", reason: "upload_failed" }),
    }), { authenticate: async () => "user-1", cancel });
    expect(response.status).toBe(400);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("passes a bounded cancellation reason into the atomic server operation", async () => {
    const cancel = jest.fn(async () => ({ cancelled: true, sessionFailed: true, reservationCancelled: true, access: null }));
    const cleanupUpload = jest.fn(async () => undefined);
    const response = await cancelAnalysisHandler(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1", reservationId: "r-1", reason: "upload_failed" }),
    }), { authenticate: async () => "user-1", cancel, cleanupUpload });
    expect(response.status).toBe(200);
    expect(cancel).toHaveBeenCalledWith("user-1", { sessionId: "session-1", reservationId: "r-1", reason: "upload_failed" });
    expect(cleanupUpload).toHaveBeenCalledWith("user-1", "session-1");
  });

  it("does not delete storage for a processing or terminal session", async () => {
    const cancel = jest.fn(async () => ({ cancelled: false, sessionFailed: false, reservationCancelled: false, access: null }));
    const cleanupUpload = jest.fn(async () => undefined);
    const response = await cancelAnalysisHandler(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-processing", reason: "user_discarded" }),
    }), { authenticate: async () => "user-1", cancel, cleanupUpload });
    expect(response.status).toBe(200);
    expect(cleanupUpload).not.toHaveBeenCalled();
  });

  it("keeps the atomic cancellation successful when best-effort storage cleanup fails", async () => {
    const cancel = jest.fn(async () => ({ cancelled: true, sessionFailed: true, reservationCancelled: true, access: null }));
    const cleanupUpload = jest.fn(async () => { throw new Error("storage unavailable"); });
    const response = await cancelAnalysisHandler(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1", reason: "upload_failed" }),
    }), { authenticate: async () => "user-1", cancel, cleanupUpload });
    expect(response.status).toBe(200);
  });

  it("rejects unrecognized cancellation reasons", async () => {
    const cancel = jest.fn();
    const response = await cancelAnalysisHandler(new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ sessionId: "session-1", reason: "erase_everything" }),
    }), { authenticate: async () => "user-1", cancel });
    expect(response.status).toBe(400);
    expect(cancel).not.toHaveBeenCalled();
  });
});
