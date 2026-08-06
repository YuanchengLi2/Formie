import { reconcileEntitlementsHandler } from "./handler";

describe("reconcile entitlements handler", () => {
  it("continues through individual RevenueCat lookup failures", async () => {
    const saveSubscriber = jest.fn(async () => ({ status: "expired" as const }));
    const response = await reconcileEntitlementsHandler(new Request("https://example.test", { method: "POST", headers: { "x-cron-secret": "secret" } }), {
      authenticateCron: () => true,
      listUsers: async () => ({ users: ["user-1", "user-2"], hasMore: false, nextOffset: null }),
      loadSubscriber: async (id) => { if (id === "user-1") throw new Error("provider"); return { appUserId: id, entitlements: [] }; },
      saveSubscriber,
      releaseStaleReservations: async () => 2,
    });
    expect(response.status).toBe(200);
    expect(saveSubscriber).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({ reconciled: 1, updated: 0, expired: 1, skipped: 0, failed: 1, released: 2, hasMore: false, nextOffset: null });
  });

  it("passes a bounded offset and returns a continuation cursor", async () => {
    const listUsers = jest.fn().mockResolvedValue({ users: ["user-501"], hasMore: true, nextOffset: 501 });
    const response = await reconcileEntitlementsHandler(new Request("https://example.test?offset=500&limit=1", { method: "POST" }), {
      authenticateCron: () => true,
      listUsers,
      loadSubscriber: async (id) => ({ appUserId: id, entitlements: [] }),
      saveSubscriber: async () => ({ status: "active" }),
      releaseStaleReservations: async () => 0,
    });
    expect(response.status).toBe(200);
    expect(listUsers).toHaveBeenCalledWith({ offset: 500, limit: 1 });
    expect(await response.json()).toMatchObject({ updated: 1, hasMore: true, nextOffset: 501 });
  });
});
