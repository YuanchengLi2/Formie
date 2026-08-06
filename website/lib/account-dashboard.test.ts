import assert from "node:assert/strict";
import test from "node:test";
import { getAccountDashboard, parseAccountDashboard } from "./account-dashboard";

const dashboard = { account: { email: "u@example.com", displayName: "Yuan", profileExists: true }, usage: { status: "active", used: 3, limit: 10, remaining: 7, periodStart: "2026-08-01T00:00:00Z", resetsAt: "2026-09-01T00:00:00Z" }, subscription: { state: "active_renewing", productIdentifier: "monthly", store: "app_store", paidThrough: "2026-09-01T00:00:00Z", cancelUrl: "https://apple.test", renewalUrl: null, sandbox: false } } as const;
test("validates the account dashboard DTO", () => { assert.equal(parseAccountDashboard(dashboard).usage.remaining, 7); assert.throws(() => parseAccountDashboard({ account: {} })); });
test("accepts an authenticated account that has never subscribed", () => {
  const value = {
    account: { email: "u@example.com", displayName: "Yuan", profileExists: true },
    usage: { status: "expired", used: 0, limit: 10, remaining: 0, periodStart: null, resetsAt: null },
    subscription: { state: "not_subscribed", productIdentifier: null, store: null, paidThrough: null, cancelUrl: null, renewalUrl: null, sandbox: false },
  } as const;

  assert.equal(parseAccountDashboard(value).subscription.state, "not_subscribed");
});
test("rejects contradictory or incomplete active periods instead of showing zero", () => {
  assert.throws(() => parseAccountDashboard({ ...dashboard, usage: { ...dashboard.usage, periodStart: null } }), /invalid response/i);
  assert.throws(() => parseAccountDashboard({ ...dashboard, usage: { ...dashboard.usage, used: 11, remaining: 0 } }), /invalid response/i);
  assert.throws(() => parseAccountDashboard({ ...dashboard, subscription: { ...dashboard.subscription, state: "expired" } }), /invalid response/i);
});
test("normalizes Edge Function errors", async () => { await assert.rejects(() => getAccountDashboard({ functions: { invoke: async () => ({ data: null, error: new Error("secret provider error") }) } } as never), /could not be loaded/i); });
