import { analysisEntryHref, canOpenCompletedAccount, canOpenSubscriptionScreen, formatAnalysisBalance, formatAnalysisEntryLabel, formatAnalysisFraction, formatBillingTimestamp, formatSubscriptionDate, formatSubscriptionStateLabel, resolveAnalysisEntry } from "./account-access";
import type { AccessStatus } from "./types";

const access = (status: AccessStatus["status"], canAnalyze: boolean, remaining: number | null): AccessStatus => ({
  status,
  canAnalyze,
  quotaUsed: remaining === null ? null : 10 - remaining,
  quotaLimit: remaining === null ? null : 10,
  remaining,
  periodStartsAt: "2026-08-01T00:00:00.000Z",
  periodEndsAt: "2026-09-01T00:00:00.000Z",
  entitlementId: status === "unknown" ? null : "formie_pro",
  source: status === "unknown" ? "unknown" : "revenuecat",
  refreshedAt: "2026-08-06T00:00:00.000Z",
  lifecycleState: status === "active" ? "active_renewing" : status === "expired" ? "expired" : "unknown",
  planCode: "monthly",
  productIdentifier: "formie_monthly",
  store: "test_store",
  sandbox: true,
  willRenew: status === "active",
  billingPeriodStartsAt: "2026-08-01T00:00:00.000Z",
  paidThrough: "2026-09-01T00:00:00.000Z",
  quotaPeriodStartsAt: "2026-08-01T00:00:00.000Z",
  quotaResetsAt: "2026-09-01T00:00:00.000Z",
  pendingAnalysisSessionId: null,
  stateVersion: 1,
});

describe("completed account admission", () => {
  it("keeps completed active and expired accounts accessible after verification", () => {
    expect(canOpenCompletedAccount({ authenticated: true, profileComplete: true, onboardingStatus: "complete", accessStatus: "active" })).toBe(true);
    expect(canOpenCompletedAccount({ authenticated: true, profileComplete: true, onboardingStatus: "complete", accessStatus: "expired" })).toBe(true);
    expect(canOpenCompletedAccount({ authenticated: true, profileComplete: true, onboardingStatus: "complete", accessStatus: "unknown" })).toBe(false);
  });

  it("ignores a stale device logout marker after a completed user authenticates again", () => {
    expect(canOpenCompletedAccount({ authenticated: true, profileComplete: true, onboardingStatus: "logged_out", accessStatus: "active" })).toBe(true);
  });

  it("ignores stale premium state after the server profile is complete", () => {
    expect(canOpenCompletedAccount({ authenticated: true, profileComplete: true, onboardingStatus: "premium_required", accessStatus: "expired" })).toBe(true);
    expect(canOpenCompletedAccount({ authenticated: true, profileComplete: true, onboardingStatus: "premium_required", accessStatus: "active" })).toBe(true);
  });

  it("never admits signed-out or incomplete profiles", () => {
    expect(canOpenCompletedAccount({ authenticated: false, profileComplete: true, onboardingStatus: "complete", accessStatus: "active" })).toBe(false);
    expect(canOpenCompletedAccount({ authenticated: true, profileComplete: false, onboardingStatus: "complete", accessStatus: "active" })).toBe(false);
  });
});

describe("subscription screen admission", () => {
  it("depends on the authenticated completed profile rather than stale onboarding state", () => {
    expect(canOpenSubscriptionScreen({ authenticated: true, profileComplete: true })).toBe(true);
    expect(canOpenSubscriptionScreen({ authenticated: false, profileComplete: true })).toBe(false);
    expect(canOpenSubscriptionScreen({ authenticated: true, profileComplete: false })).toBe(false);
  });
});

describe("analysis entry policy", () => {
  it("preserves a new account's intent to start an analysis through purchase", () => {
    expect(analysisEntryHref("purchase", null)).toBe("/subscription?returnTo=%2Fexercise-selection");
    expect(analysisEntryHref("record", null)).toBe("/exercise-selection");
    expect(analysisEntryHref("analysis_pending", "session-1")).toBe("/analysis/session-1");
    expect(analysisEntryHref("quota_exhausted", null)).toBeNull();
  });

  it("records only with confirmed usable access", () => {
    expect(resolveAnalysisEntry("ready", access("active", true, 8))).toBe("record");
  });

  it("separates quota exhaustion from an expired subscription", () => {
    expect(resolveAnalysisEntry("ready", access("active", false, 0))).toBe("quota_exhausted");
    expect(resolveAnalysisEntry("ready", access("expired", false, 0))).toBe("purchase");
  });

  it("keeps an exhausted or canceled account on a gray Record action", () => {
    expect(formatAnalysisEntryLabel("quota_exhausted", "active_cancelled", 0)).toBe("Record");
    expect(formatAnalysisEntryLabel("quota_exhausted", "active_renewing", 0)).toBe("Record");
  });

  it("does not start recording while access is unresolved", () => {
    expect(resolveAnalysisEntry("loading", access("unknown", false, null))).toBe("unavailable");
    expect(resolveAnalysisEntry("error", access("active", true, 8))).toBe("unavailable");
  });

  it("routes a pending analysis before allowing another recording", () => {
    expect(resolveAnalysisEntry("ready", { ...access("active", false, 7), pendingAnalysisSessionId: "session-1" })).toBe("analysis_pending");
  });

  it("separates renewal synchronization from final expiration", () => {
    expect(resolveAnalysisEntry("ready", { ...access("unknown", false, 0), lifecycleState: "renewal_pending" })).toBe("renewal_pending");
  });
});

describe("Home analysis balance", () => {
  it("formats numeric, expired, and unresolved balances", () => {
    expect(formatAnalysisBalance(access("active", true, 8))).toBe("8 analyses left");
    expect(formatAnalysisBalance(access("active", true, 1))).toBe("1 analysis left");
    expect(formatAnalysisBalance(access("expired", false, null))).toBe("Subscription required");
    expect(formatAnalysisBalance(access("unknown", false, null))).toBe("Checking analyses");
  });

  it("formats a bounded quota fraction without redundant words", () => {
    expect(formatAnalysisFraction(9, 10)).toBe("9/10");
    expect(formatAnalysisFraction(15, 10)).toBe("10/10");
    expect(formatAnalysisFraction(null, 0)).toBe("—/10");
  });
});

describe("subscription calendar dates", () => {
  it("uses the provider billing date in UTC so app and web do not disagree by one day", () => {
    expect(formatSubscriptionDate("2026-09-01T00:00:00.000Z")).toBe("Sep 1, 2026");
  });

  it("does not render invalid provider timestamps", () => {
    expect(formatSubscriptionDate("not-a-date")).toBe("Not available");
    expect(formatSubscriptionDate(null)).toBe("Not available");
  });

  it("labels cancelled, expired, and never-subscribed settings without claiming renewal", () => {
    expect(formatSubscriptionStateLabel({ lifecycleState: "active_cancelled", paidThrough: "2026-09-01T08:56:00Z" }, "en-US", "UTC")).toBe("Canceled · Automatic renewal off · Access ends Sep 1, 2026 at 8:56 AM UTC");
    expect(formatSubscriptionStateLabel({ lifecycleState: "expired", paidThrough: "2026-09-01T08:56:00Z" }, "en-US", "UTC")).toBe("Expired · Automatic renewal off · Access ended Sep 1, 2026 at 8:56 AM UTC");
    expect(formatSubscriptionStateLabel({ lifecycleState: "active_renewing", paidThrough: "2026-09-01T08:56:00Z" }, "en-US", "UTC")).toBe("Active · Automatic renewal on · Next billing Sep 1, 2026 at 8:56 AM UTC");
    expect(formatSubscriptionStateLabel({ lifecycleState: "renewal_pending", paidThrough: "2026-09-01T08:56:00Z" })).toBe("Checking renewal · Automatic renewal pending");
    expect(formatSubscriptionStateLabel({ lifecycleState: "not_subscribed", paidThrough: null })).toBe("No active subscription · Automatic renewal off");
  });

  it("formats an exact billing timestamp with an explicit time zone", () => {
    expect(formatBillingTimestamp("2026-09-07T08:56:00Z", "en-US", "UTC")).toBe("Sep 7, 2026 at 8:56 AM UTC");
  });
});
