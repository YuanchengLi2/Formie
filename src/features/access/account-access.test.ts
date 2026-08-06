import { canOpenCompletedAccount, formatAnalysisBalance, resolveAnalysisEntry } from "./account-access";
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

describe("analysis entry policy", () => {
  it("records only with confirmed usable access", () => {
    expect(resolveAnalysisEntry("ready", access("active", true, 8))).toBe("record");
  });

  it("separates quota exhaustion from an expired subscription", () => {
    expect(resolveAnalysisEntry("ready", access("active", false, 0))).toBe("quota_exhausted");
    expect(resolveAnalysisEntry("ready", access("expired", false, 0))).toBe("purchase");
  });

  it("does not start recording while access is unresolved", () => {
    expect(resolveAnalysisEntry("loading", access("unknown", false, null))).toBe("unavailable");
    expect(resolveAnalysisEntry("error", access("active", true, 8))).toBe("unavailable");
  });
});

describe("Home analysis balance", () => {
  it("formats numeric, expired, and unresolved balances", () => {
    expect(formatAnalysisBalance(access("active", true, 8))).toBe("8 analyses left");
    expect(formatAnalysisBalance(access("active", true, 1))).toBe("1 analysis left");
    expect(formatAnalysisBalance(access("expired", false, null))).toBe("Subscription required");
    expect(formatAnalysisBalance(access("unknown", false, null))).toBe("Checking analyses");
  });
});
