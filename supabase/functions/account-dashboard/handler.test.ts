import { accountDashboardHandler } from "./handler";

describe("accountDashboardHandler", () => {
  it("returns the sanitized authenticated dashboard DTO after one provider fetch", async () => {
    const subscriber = { appUserId: "u1", managementUrl: "https://apps.apple.com/account/subscriptions", entitlements: [], subscriptions: [{ productIdentifier: "monthly", store: "app_store", expirationDate: "2026-09-01T00:00:00Z", unsubscribeDetectedAt: null, sandbox: false }] };
    const deps = { authenticate: jest.fn().mockResolvedValue({ id: "u1", email: "u@example.com" }), loadSubscriber: jest.fn().mockResolvedValue(subscriber), persistLedger: jest.fn().mockResolvedValue({ status: "active" }), loadDashboardData: jest.fn().mockResolvedValue({ displayName: "Yuan", profileExists: true, access: { status: "active", lifecycle_state: "active_renewing", plan_code: "monthly", product_identifier: "monthly", store: "app_store", sandbox: false, will_renew: true, billing_period_starts_at: "2026-08-01T00:00:00Z", paid_through: "2026-09-01T00:00:00Z", quota_used: 3, quota_limit: 10, remaining: 7, quota_period_starts_at: "2026-08-01T00:00:00Z", quota_resets_at: "2026-09-01T00:00:00Z" } }) };
    const response = await accountDashboardHandler(new Request("https://edge.test", { method: "GET", headers: { Authorization: "Bearer jwt" } }), deps as never, new Date("2026-08-05T00:00:00Z"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { used: 3, remaining: 7, periodStart: "2026-08-01T00:00:00Z" }, subscription: { state: "active_renewing", planCode: "monthly", willRenew: true, store: "app_store" } });
    expect(deps.loadSubscriber).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(payload).toLowerCase()).not.toMatch(/secret|raw|token/);
  });

  it("renders the normalized ledger lifecycle instead of independently reinterpreting provider data", async () => {
    const subscriber = { appUserId: "u1", managementUrl: "https://apps.apple.com/account/subscriptions", entitlements: [], subscriptions: [{ productIdentifier: "formie_yearly", store: "app_store", expirationDate: "2027-08-01T00:00:00Z", unsubscribeDetectedAt: "2026-08-02T00:00:00Z", sandbox: false }] };
    const access = { status: "active", lifecycle_state: "active_renewing", plan_code: "annual", product_identifier: "formie_yearly", store: "app_store", sandbox: false, will_renew: true, billing_period_starts_at: "2026-08-01T00:00:00Z", paid_through: "2027-08-01T00:00:00Z", quota_used: 4, quota_limit: 10, remaining: 6, quota_period_starts_at: "2026-08-01T00:00:00Z", quota_resets_at: "2026-09-01T00:00:00Z" };
    const deps = { authenticate: jest.fn().mockResolvedValue({ id: "u1", email: "u@example.com" }), loadSubscriber: jest.fn().mockResolvedValue(subscriber), persistLedger: jest.fn().mockResolvedValue({ status: "active" }), loadDashboardData: jest.fn().mockResolvedValue({ displayName: "Yuan", profileExists: true, access }) };
    const response = await accountDashboardHandler(new Request("https://edge.test"), deps as never);
    await expect(response.json()).resolves.toMatchObject({ usage: { remaining: 6, resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_renewing", planCode: "annual", willRenew: true, billingPeriodStart: "2026-08-01T00:00:00Z" } });
  });

  it("returns a distinct state when the authenticated account never subscribed", async () => {
    const subscriber = { appUserId: "u1", managementUrl: null, entitlements: [], subscriptions: [] };
    const deps = { authenticate: jest.fn().mockResolvedValue({ id: "u1", email: "u@example.com" }), loadSubscriber: jest.fn().mockResolvedValue(subscriber), persistLedger: jest.fn().mockResolvedValue({ status: "expired" }), loadDashboardData: jest.fn().mockResolvedValue({ displayName: "Yuan", profileExists: true, access: { status: "expired", quota_used: 0, quota_limit: 10, remaining: 0, period_ends_at: null } }) };

    const response = await accountDashboardHandler(new Request("https://edge.test", { method: "GET", headers: { Authorization: "Bearer jwt" } }), deps as never, new Date("2026-08-05T00:00:00Z"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      subscription: {
        state: "not_subscribed",
        productIdentifier: null,
        store: null,
        paidThrough: null,
        cancelUrl: null,
        renewalUrl: null,
      },
    });
  });

  it("reports when OAuth succeeded but no Formie app profile exists", async () => {
    const subscriber = { appUserId: "u1", managementUrl: null, entitlements: [], subscriptions: [] };
    const deps = { authenticate: jest.fn().mockResolvedValue({ id: "u1", email: "u@example.com" }), loadSubscriber: jest.fn().mockResolvedValue(subscriber), persistLedger: jest.fn().mockResolvedValue({ status: "expired" }), loadDashboardData: jest.fn().mockResolvedValue({ displayName: "Formie Athlete", profileExists: false, access: { status: "expired", quota_used: 0, quota_limit: 10, remaining: 0, period_ends_at: null } }) };

    const response = await accountDashboardHandler(new Request("https://edge.test", { method: "GET" }), deps as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ account: { profileExists: false }, subscription: { state: "not_subscribed" } });
  });

  it("rejects unauthenticated requests", async () => {
    const response = await accountDashboardHandler(new Request("https://edge.test"), { authenticate: jest.fn().mockRejectedValue(new Error("UNAUTHORIZED")) } as never);
    expect(response.status).toBe(401);
  });
});
