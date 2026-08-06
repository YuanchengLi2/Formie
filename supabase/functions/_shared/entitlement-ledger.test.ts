import { persistEntitlementLedger } from "./entitlement-ledger";

function chain(result: unknown) { const value: Record<string, jest.Mock> = {}; for (const name of ["select", "eq", "maybeSingle", "upsert", "single"]) value[name] = jest.fn(() => value); value.maybeSingle.mockResolvedValue(result); value.single.mockResolvedValue({ data: { status: "expired" }, error: null }); return value; }

describe("persistEntitlementLedger", () => {
  it("reconciles legacy rows against RevenueCat instead of preserving unlimited access", async () => {
    const query = chain({ data: { status: "legacy_unlimited" }, error: null });
    const admin = { from: jest.fn(() => query) };
    await expect(persistEntitlementLedger(admin as never, "u1", { appUserId: "u1", entitlements: [], subscriptions: [], managementUrl: null })).resolves.toMatchObject({ status: "expired" });
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u1", status: "expired", revenuecat_app_user_id: "u1" }), { onConflict: "user_id" });
  });

  it("never persists active after the provider period ends", async () => {
    const query = chain({ data: null, error: null });
    const admin = { from: jest.fn(() => query) };
    await persistEntitlementLedger(admin as never, "u1", { appUserId: "u1", managementUrl: null, subscriptions: [], entitlements: [{ identifier: "formie_pro", productIdentifier: "monthly", purchaseDate: "2026-07-01T00:00:00Z", expirationDate: "2026-08-01T00:00:00Z" }] }, "formie_pro", new Date("2026-08-05T00:00:00Z"));
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ status: "expired" }), { onConflict: "user_id" });
  });

  it("does not regress a newer ledger period when a stale provider snapshot arrives", async () => {
    const existing = { status: "active", entitlement_id: "formie_pro", current_period_start: "2026-09-01T00:00:00Z", current_period_end: "2026-10-01T00:00:00Z", store_product_id: "monthly" };
    const query = chain({ data: existing, error: null });
    const admin = { from: jest.fn(() => query) };
    await expect(persistEntitlementLedger(admin as never, "u1", { appUserId: "u1", managementUrl: null, subscriptions: [{ productIdentifier: "monthly", store: "app_store", expirationDate: "2026-09-01T00:00:00Z", unsubscribeDetectedAt: null, sandbox: false }], entitlements: [{ identifier: "formie_pro", productIdentifier: "monthly", purchaseDate: "2026-08-01T00:00:00Z", expirationDate: "2026-09-01T00:00:00Z" }] }, "formie_pro", new Date("2026-08-15T00:00:00Z"))).resolves.toEqual(existing);
    expect(query.upsert).not.toHaveBeenCalled();
  });
});
