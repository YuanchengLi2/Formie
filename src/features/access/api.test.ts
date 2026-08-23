import { readFileSync } from "node:fs";

import { asAccess, cancelAnalysis, refreshProviderAccess, refreshProviderAccessUntilChanged } from "./api";
import { subscribeAccessMutations } from "./access-events";
import type { AccessStatus } from "./types";

const mockInvoke = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    rpc: jest.fn(),
  },
}));

describe("asAccess", () => {
  it("maps the normalized billing, quota, renewal, and pending-analysis contract", () => {
    expect(asAccess([{
      status: "active", lifecycle_state: "active_cancelled", can_analyze: false, quota_used: 3, quota_limit: 10, remaining: 7,
      quota_period_start: "2026-08-01T00:00:00Z", quota_period_end: "2026-09-01T00:00:00Z",
      billing_period_start: "2026-01-31T00:00:00Z", billing_period_end: "2027-01-31T00:00:00Z",
      product_identifier: "formie_yearly", plan_code: "annual", store: "app_store", sandbox: false, will_renew: false,
      pending_analysis_session_id: "session-1", entitlement_id: "formie_pro", source: "revenuecat",
    }])).toMatchObject({
      status: "active", lifecycleState: "active_cancelled", canAnalyze: false, quotaUsed: 3, remaining: 7,
      quotaPeriodStartsAt: "2026-08-01T00:00:00Z", quotaResetsAt: "2026-09-01T00:00:00Z",
      billingPeriodStartsAt: "2026-01-31T00:00:00Z", paidThrough: "2027-01-31T00:00:00Z",
      productIdentifier: "formie_yearly", planCode: "annual", willRenew: false, pendingAnalysisSessionId: "session-1",
    });
  });

  it("normalizes the camelCase access contract returned by refresh-entitlement", () => {
    expect(asAccess({
      status: "active", lifecycleState: "active_cancelled", canAnalyze: false, quotaUsed: 10, quotaLimit: 10, remaining: 0,
      quotaPeriodStartsAt: "2026-08-07T08:36:38Z", quotaResetsAt: "2026-08-07T08:56:38Z",
      billingPeriodStartsAt: "2026-08-07T08:36:38Z", paidThrough: "2026-08-07T08:56:38Z",
      productIdentifier: "formie_monthly", planCode: "monthly", store: "test_store", sandbox: true, willRenew: false,
      pendingAnalysisSessionId: null, stateVersion: 12, entitlementId: "formie_pro", source: "revenuecat",
    })).toMatchObject({
      status: "active", lifecycleState: "active_cancelled", canAnalyze: false, remaining: 0,
      quotaResetsAt: "2026-08-07T08:56:38Z", paidThrough: "2026-08-07T08:56:38Z", stateVersion: 12,
    });
  });
});

describe("provider access refresh", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("uses the authenticated user refresh endpoint instead of the cron reconciler", async () => {
    mockInvoke.mockResolvedValue({
      data: { access: { status: "expired", lifecycleState: "expired", remaining: 0, source: "revenuecat" } },
      error: null,
    });

    await expect(refreshProviderAccess("jwt")).resolves.toMatchObject({ status: "expired", lifecycleState: "expired" });
    expect(mockInvoke).toHaveBeenCalledWith("refresh-entitlement", { headers: { Authorization: "Bearer jwt" } });
    expect(mockInvoke).not.toHaveBeenCalledWith("reconcile-entitlements", expect.anything());
  });

  it("contains no client invocation of the cron-only reconciliation function", () => {
    expect(readFileSync(__filename.replace(/api\.test\.ts$/, "api.ts"), "utf8")).not.toMatch(/invoke\(["']reconcile-entitlements["']/);
  });

  it("retries a provider refresh so an external cancellation can reach the app after provider propagation", async () => {
    const unchanged = asAccess({ status: "active", lifecycleState: "active_renewing", remaining: 4, stateVersion: 8, willRenew: true, source: "revenuecat" });
    const cancelled = asAccess({ status: "active", lifecycleState: "active_cancelled", remaining: 4, stateVersion: 9, willRenew: false, source: "revenuecat" });
    const refresh = jest.fn<Promise<AccessStatus>, [string]>()
      .mockResolvedValueOnce(unchanged)
      .mockResolvedValueOnce(cancelled);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(refreshProviderAccessUntilChanged("jwt", unchanged, refresh, [0, 1], wait)).resolves.toMatchObject({ lifecycleState: "active_cancelled" });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1);
  });
});

describe("analysis cancellation", () => {
  beforeEach(() => mockInvoke.mockReset());

  it("sends the session-aware upload failure and publishes authoritative quota", async () => {
    const mutations: unknown[] = [];
    const unsubscribe = subscribeAccessMutations((mutation) => mutations.push(mutation));
    mockInvoke.mockResolvedValue({
      data: { sessionFailed: true, reservationCancelled: true, access: { remaining: 9, period_ends_at: "2026-09-01T00:00:00Z" } },
      error: null,
    });

    await cancelAnalysis({ sessionId: "session-1", reservationId: "reservation-1", reason: "upload_failed" });

    expect(mockInvoke).toHaveBeenCalledWith("cancel-analysis", {
      body: { sessionId: "session-1", reservationId: "reservation-1", reason: "upload_failed" },
    });
    expect(mutations).toEqual([{ remaining: 9, periodEndsAt: "2026-09-01T00:00:00Z" }]);
    unsubscribe();
  });

  it("keeps reservation-only cancellation compatible with released clients", async () => {
    mockInvoke.mockResolvedValue({ data: { cancelled: true, access: null }, error: null });
    await expect(cancelAnalysis({ reservationId: "reservation-legacy" })).resolves.toBeUndefined();
    expect(mockInvoke).toHaveBeenCalledWith("cancel-analysis", { body: { reservationId: "reservation-legacy" } });
  });
});
