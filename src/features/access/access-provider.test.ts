import { accessExpiryRefreshDelay, mergeAccessMutation, shouldCommitAccessRefresh } from "./access-provider";
import { unknownAccess } from "./types";

describe("access status", () => {
  it("starts closed until the server confirms entitlement", () => {
    expect(unknownAccess.canAnalyze).toBe(false);
    expect(unknownAccess.status).toBe("unknown");
  });

  it("rejects a late access result after the authenticated identity changes", () => {
    expect(shouldCommitAccessRefresh("user-a", "user-a")).toBe(true);
    expect(shouldCommitAccessRefresh("user-a", "user-b")).toBe(false);
    expect(shouldCommitAccessRefresh("user-a", null)).toBe(false);
  });

  it("refreshes at the paid-through timestamp instead of waiting for the polling interval", () => {
    expect(accessExpiryRefreshDelay("2026-09-05T12:00:00.000Z", new Date("2026-09-05T11:59:55.000Z").getTime())).toBe(6_000);
    expect(accessExpiryRefreshDelay("2026-09-05T12:00:00.000Z", new Date("2026-09-05T12:00:05.000Z").getTime())).toBe(0);
  });

  it("applies an authoritative reservation balance immediately", () => {
    expect(mergeAccessMutation({
      ...unknownAccess,
      status: "active",
      canAnalyze: true,
      quotaUsed: 0,
      quotaLimit: 10,
      remaining: 10,
      periodStartsAt: "2026-08-01T00:00:00Z",
      periodEndsAt: "2026-09-01T00:00:00Z",
      entitlementId: "formie_pro",
      source: "revenuecat",
    }, { remaining: 9, periodEndsAt: "2026-09-01T00:00:00Z" })).toMatchObject({ remaining: 9, quotaUsed: 1, canAnalyze: true });
  });
});
