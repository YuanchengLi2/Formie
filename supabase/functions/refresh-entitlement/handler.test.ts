import { refreshEntitlementHandler } from "./handler";

describe("refresh entitlement handler", () => {
  it("uses the authenticated Supabase UUID as the RevenueCat app user ID", async () => {
    const saveAccess = jest.fn(async () => ({ status: "active" as const, entitlement_id: "formie_pro", current_period_start: "2026-08-01T00:00:00.000Z", current_period_end: "2026-09-01T00:00:00.000Z", store_product_id: "formie.monthly" }));
    const response = await refreshEntitlementHandler(new Request("https://example.test", { method: "POST", headers: { Authorization: "Bearer jwt" }, body: "{}" }), {
      authenticate: async () => "user-1",
      loadSubscriber: async (id) => ({ appUserId: id, entitlements: [{ identifier: "formie_pro", productIdentifier: "formie.monthly", purchaseDate: "2026-08-01T00:00:00.000Z", expirationDate: "2026-09-01T00:00:00.000Z" }] }),
      saveAccess,
      loadAccess: async () => ({ status: "active", can_analyze: true, quota_used: 2, quota_limit: 10, remaining: 8, period_starts_at: "2026-08-01T00:00:00.000Z", period_ends_at: "2026-09-01T00:00:00.000Z", entitlement_id: "formie_pro", source: "revenuecat" }),
    });
    expect(response.status).toBe(200);
    expect(saveAccess).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", activeEntitlementId: "formie_pro" }));
    await expect(response.json()).resolves.toMatchObject({ access: { status: "active", quotaUsed: 2, remaining: 8, periodStartsAt: "2026-08-01T00:00:00.000Z" }, subscription: { state: "active_renewing" } });
  });
});
