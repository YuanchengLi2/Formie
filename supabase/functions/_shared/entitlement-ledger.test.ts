import { applyRevenueCatLifecycleEvent, lifecycleEventLedgerPatch, persistEntitlementLedger } from "./entitlement-ledger";

function chain(result: unknown) { const value: Record<string, jest.Mock> = {}; for (const name of ["select", "eq", "maybeSingle", "upsert", "single", "delete", "update"]) value[name] = jest.fn(() => value); value.maybeSingle.mockResolvedValue(result); value.single.mockResolvedValue({ data: { status: "expired" }, error: null }); value.delete.mockImplementation(() => value); value.update.mockImplementation(() => value); return value; }

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

  it("does not rewrite an unchanged provider snapshot or increment state_version", async () => {
    const existing = {
      status: "active",
      entitlement_id: "formie_pro",
      current_period_start: "2026-08-01T00:00:00Z",
      current_period_end: "2026-09-01T00:00:00Z",
      store_product_id: "formie_monthly",
      lifecycle_state: "active_renewing",
      plan_code: "monthly",
      store: "test_store",
      sandbox: true,
      will_renew: true,
      billing_period_start: "2026-08-01T00:00:00Z",
      billing_period_end: "2026-09-01T00:00:00Z",
      latest_event_at: null,
      latest_revenuecat_event_id: null,
      state_version: 42,
    };
    const query = chain({ data: existing, error: null });
    const admin = { from: jest.fn(() => query) };

    await expect(persistEntitlementLedger(admin as never, "u1", {
      appUserId: "u1",
      managementUrl: null,
      subscriptions: [{ productIdentifier: "formie_monthly", store: "test_store", purchaseDate: "2026-08-01T00:00:00Z", expirationDate: "2026-09-01T00:00:00Z", unsubscribeDetectedAt: null, sandbox: true }],
      entitlements: [{ identifier: "formie_pro", productIdentifier: "formie_monthly", purchaseDate: "2026-08-01T00:00:00Z", expirationDate: "2026-09-01T00:00:00Z" }],
    }, "formie_pro", new Date("2026-08-07T00:00:00Z"))).resolves.toEqual(existing);
    expect(query.upsert).not.toHaveBeenCalled();
  });

  it("lets a direct RevenueCat refresh restore renewal within the same paid period", async () => {
    const existing = {
      status: "active",
      entitlement_id: "formie_pro",
      current_period_start: "2026-08-01T00:00:00Z",
      current_period_end: "2026-09-01T00:00:00Z",
      store_product_id: "formie_monthly",
      lifecycle_state: "active_cancelled",
      plan_code: "monthly",
      store: "app_store",
      sandbox: false,
      will_renew: false,
      billing_period_start: "2026-08-01T00:00:00Z",
      billing_period_end: "2026-09-01T00:00:00Z",
      latest_event_at: "2026-08-07T12:00:00Z",
      latest_revenuecat_event_id: "cancel-event",
      state_version: 12,
    };
    const query = chain({ data: existing, error: null });
    query.single.mockResolvedValue({ data: { ...existing, lifecycle_state: "active_renewing", will_renew: true, state_version: 13 }, error: null });
    const admin = { from: jest.fn(() => query) };

    await persistEntitlementLedger(admin as never, "u1", {
      appUserId: "u1",
      managementUrl: "https://apps.apple.com/account/subscriptions",
      subscriptions: [{ productIdentifier: "formie_monthly", store: "app_store", purchaseDate: "2026-08-01T00:00:00Z", expirationDate: "2026-09-01T00:00:00Z", unsubscribeDetectedAt: null, sandbox: false }],
      entitlements: [{ identifier: "formie_pro", productIdentifier: "formie_monthly", purchaseDate: "2026-08-01T00:00:00Z", expirationDate: "2026-09-01T00:00:00Z" }],
    }, "formie_pro", new Date("2026-08-08T00:00:00Z"));

    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      lifecycle_state: "active_renewing",
      will_renew: true,
      billing_period_end: "2026-09-01T00:00:00Z",
    }), { onConflict: "user_id" });
  });

  it("preserves the webhook event during its immediate provider follow-up fetch", async () => {
    const existing = {
      status: "active",
      entitlement_id: "formie_pro",
      current_period_start: "2026-08-01T00:00:00Z",
      current_period_end: "2026-09-01T00:00:00Z",
      store_product_id: "formie_monthly",
      lifecycle_state: "active_cancelled",
      plan_code: "monthly",
      store: "app_store",
      sandbox: false,
      will_renew: false,
      billing_period_start: "2026-08-01T00:00:00Z",
      billing_period_end: "2026-09-01T00:00:00Z",
      latest_event_at: "2026-08-08T00:00:00Z",
      latest_revenuecat_event_id: "fresh-cancel-event",
      state_version: 14,
    };
    const query = chain({ data: existing, error: null });
    const admin = { from: jest.fn(() => query) };

    await expect(persistEntitlementLedger(admin as never, "u1", {
      appUserId: "u1",
      managementUrl: "https://apps.apple.com/account/subscriptions",
      subscriptions: [{ productIdentifier: "formie_monthly", store: "app_store", purchaseDate: "2026-08-01T00:00:00Z", expirationDate: "2026-09-01T00:00:00Z", unsubscribeDetectedAt: null, sandbox: false }],
      entitlements: [{ identifier: "formie_pro", productIdentifier: "formie_monthly", purchaseDate: "2026-08-01T00:00:00Z", expirationDate: "2026-09-01T00:00:00Z" }],
    }, "formie_pro", new Date("2026-08-08T00:00:01Z"), true)).resolves.toEqual(existing);
    expect(query.upsert).not.toHaveBeenCalled();
  });

  it("clears an expired Test Store scenario when a same-plan repurchase becomes active", async () => {
    const query = chain({ data: { status: "expired", entitlement_id: "formie_pro", current_period_start: null, current_period_end: null, store_product_id: "monthly" }, error: null });
    const scenarioQuery = chain({ data: null, error: null });
    const admin = { from: jest.fn((table: string) => table === "subscription_test_scenarios" ? scenarioQuery : query) };
    await persistEntitlementLedger(admin as never, "u1", { appUserId: "u1", managementUrl: null, subscriptions: [], entitlements: [{ identifier: "formie_pro", productIdentifier: "monthly", purchaseDate: "2026-08-07T00:00:00Z", expirationDate: "2026-08-08T00:00:00Z" }] }, "formie_pro", new Date("2026-08-07T01:00:00Z"));
    expect(scenarioQuery.delete).toHaveBeenCalled();
  });

  it("preserves a Test Store cancellation when RevenueCat reports an automatic simulated renewal", async () => {
    const existing = {
      status: "active",
      entitlement_id: "formie_pro",
      current_period_start: "2026-08-07T00:00:00Z",
      current_period_end: "2026-08-07T00:20:00Z",
      store_product_id: "formie_monthly",
      lifecycle_state: "active_cancelled",
      plan_code: "monthly",
      store: "test_store",
      sandbox: true,
      will_renew: false,
      billing_period_start: "2026-08-07T00:00:00Z",
      billing_period_end: "2026-08-07T00:20:00Z",
      latest_event_at: null,
      latest_revenuecat_event_id: null,
      state_version: 7,
    };
    const entitlementQuery = chain({ data: existing, error: null });
    entitlementQuery.single.mockResolvedValue({ data: { ...existing, lifecycle_state: "active_renewing", will_renew: true, current_period_end: "2026-08-07T00:40:00Z", billing_period_end: "2026-08-07T00:40:00Z" }, error: null });
    const scenarioQuery = chain({ data: { lifecycle_state: "active_cancelled" }, error: null });
    const admin = { from: jest.fn((table: string) => table === "subscription_test_scenarios" ? scenarioQuery : entitlementQuery) };

    await persistEntitlementLedger(admin as never, "u1", {
      appUserId: "u1",
      managementUrl: null,
      subscriptions: [{ productIdentifier: "formie_monthly", store: "test_store", purchaseDate: "2026-08-07T00:20:00Z", expirationDate: "2026-08-07T00:40:00Z", unsubscribeDetectedAt: null, sandbox: true }],
      entitlements: [{ identifier: "formie_pro", productIdentifier: "formie_monthly", purchaseDate: "2026-08-07T00:20:00Z", expirationDate: "2026-08-07T00:40:00Z" }],
    }, "formie_pro", new Date("2026-08-07T00:20:05Z"));

    expect(scenarioQuery.delete).not.toHaveBeenCalled();
  });

  it("clears a superseded active Test Store scenario when a newer provider period is reconciled", async () => {
    const existing = {
      status: "active",
      entitlement_id: "formie_pro",
      current_period_start: "2026-08-07T00:00:00Z",
      current_period_end: "2026-08-07T00:20:00Z",
      store_product_id: "formie_monthly",
      lifecycle_state: "active_renewing",
      plan_code: "monthly",
      store: "test_store",
      sandbox: true,
      will_renew: true,
      billing_period_start: "2026-08-07T00:00:00Z",
      billing_period_end: "2026-08-07T00:20:00Z",
      latest_event_at: null,
      latest_revenuecat_event_id: null,
      state_version: 7,
    };
    const entitlementQuery = chain({ data: existing, error: null });
    entitlementQuery.single.mockResolvedValue({ data: { ...existing, current_period_start: "2026-08-07T00:20:00Z", current_period_end: "2026-08-07T00:40:00Z", billing_period_start: "2026-08-07T00:20:00Z", billing_period_end: "2026-08-07T00:40:00Z" }, error: null });
    const scenarioQuery = chain({ data: { lifecycle_state: "active_renewing", billing_period_end: "2026-08-07T00:20:00Z" }, error: null });
    const admin = { from: jest.fn((table: string) => table === "subscription_test_scenarios" ? scenarioQuery : entitlementQuery) };

    await persistEntitlementLedger(admin as never, "u1", {
      appUserId: "u1",
      managementUrl: null,
      subscriptions: [{ productIdentifier: "formie_monthly", store: "test_store", purchaseDate: "2026-08-07T00:20:00Z", expirationDate: "2026-08-07T00:40:00Z", unsubscribeDetectedAt: null, sandbox: true }],
      entitlements: [{ identifier: "formie_pro", productIdentifier: "formie_monthly", purchaseDate: "2026-08-07T00:20:00Z", expirationDate: "2026-08-07T00:40:00Z" }],
    }, "formie_pro", new Date("2026-08-07T00:20:05Z"));

    expect(scenarioQuery.delete).toHaveBeenCalled();
  });
});

describe("lifecycleEventLedgerPatch", () => {
  const row = { lifecycle_state: "active_cancelled", plan_code: "monthly", store: "test_store", sandbox: true, will_renew: false, billing_period_start: "2026-08-06T23:27:16.000Z", billing_period_end: "2026-08-06T23:32:16.000Z", store_product_id: "formie_monthly", latest_event_at: "2026-08-06T23:28:16.000Z", latest_revenuecat_event_id: "cancel", state_version: 4 };

  it("undoes cancellation without changing billing dates", () => {
    expect(lifecycleEventLedgerPatch(row, { id: "uncancel", type: "UNCANCELLATION", app_user_id: "u1", product_identifier: "formie_monthly", event_timestamp: "2026-08-06T23:29:16.000Z" })).toMatchObject({
      lifecycle_state: "active_renewing",
      will_renew: true,
      billing_period_start: row.billing_period_start,
      billing_period_end: row.billing_period_end,
      state_version: 5,
    });
  });

  it("advances dates only for a valid renewal", () => {
    expect(lifecycleEventLedgerPatch(row, { id: "renew", type: "RENEWAL", app_user_id: "u1", product_identifier: "formie_monthly", purchased_at: "2026-08-06T23:32:16.000Z", expiration_at: "2026-08-06T23:37:16.000Z", event_timestamp: "2026-08-06T23:32:17.000Z", environment: "SANDBOX" })).toMatchObject({
      lifecycle_state: "active_renewing",
      will_renew: true,
      billing_period_start: "2026-08-06T23:32:16.000Z",
      billing_period_end: "2026-08-06T23:37:16.000Z",
      current_period_start: "2026-08-06T23:32:16.000Z",
      current_period_end: "2026-08-06T23:37:16.000Z",
    });
  });

  it("preserves a Test Store cancellation when the RevenueCat renewal webhook arrives", async () => {
    const entitlementQuery = chain({ data: { status: "active", entitlement_id: "formie_pro", current_period_start: "2026-08-06T23:27:16.000Z", current_period_end: "2026-08-06T23:32:16.000Z", store_product_id: "formie_monthly", lifecycle_state: "active_cancelled", plan_code: "monthly", store: "test_store", sandbox: true, will_renew: false, billing_period_start: "2026-08-06T23:27:16.000Z", billing_period_end: "2026-08-06T23:32:16.000Z", latest_event_at: "2026-08-06T23:28:16.000Z", latest_revenuecat_event_id: "cancel", state_version: 4 }, error: null });
    const webhookQuery = chain({ data: null, error: null });
    const scenarioQuery = chain({ data: { lifecycle_state: "active_cancelled", billing_period_end: "2026-08-06T23:32:16.000Z" }, error: null });
    const admin = { from: jest.fn((table: string) => table === "user_access_entitlements" ? entitlementQuery : table === "revenuecat_webhook_events" ? webhookQuery : scenarioQuery) };

    await applyRevenueCatLifecycleEvent(admin as never, "u1", {
      id: "renew",
      type: "RENEWAL",
      app_user_id: "u1",
      product_identifier: "formie_monthly",
      purchased_at: "2026-08-06T23:32:16.000Z",
      expiration_at: "2026-08-06T23:37:16.000Z",
      event_timestamp: "2026-08-06T23:32:17.000Z",
      environment: "SANDBOX",
    });

    expect(scenarioQuery.delete).not.toHaveBeenCalled();
  });

  it("clears an active Test Store scenario when the RevenueCat renewal webhook advances its period", async () => {
    const entitlementQuery = chain({ data: { status: "active", entitlement_id: "formie_pro", current_period_start: "2026-08-06T23:27:16.000Z", current_period_end: "2026-08-06T23:32:16.000Z", store_product_id: "formie_monthly", lifecycle_state: "active_renewing", plan_code: "monthly", store: "test_store", sandbox: true, will_renew: true, billing_period_start: "2026-08-06T23:27:16.000Z", billing_period_end: "2026-08-06T23:32:16.000Z", latest_event_at: null, latest_revenuecat_event_id: null, state_version: 4 }, error: null });
    const webhookQuery = chain({ data: null, error: null });
    const scenarioQuery = chain({ data: { lifecycle_state: "active_renewing", billing_period_end: "2026-08-06T23:32:16.000Z" }, error: null });
    const admin = { from: jest.fn((table: string) => table === "user_access_entitlements" ? entitlementQuery : table === "revenuecat_webhook_events" ? webhookQuery : scenarioQuery) };

    await applyRevenueCatLifecycleEvent(admin as never, "u1", {
      id: "renew",
      type: "RENEWAL",
      app_user_id: "u1",
      product_identifier: "formie_monthly",
      purchased_at: "2026-08-06T23:32:16.000Z",
      expiration_at: "2026-08-06T23:37:16.000Z",
      event_timestamp: "2026-08-06T23:32:17.000Z",
      environment: "SANDBOX",
    });

    expect(scenarioQuery.delete).toHaveBeenCalled();
  });
});
