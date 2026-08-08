import { accessBoundaryRefreshDelays, accessExpiryRefreshDelay, mergeAccessMutation, renewalReconciliationDelays, shouldCommitAccessRefresh } from "./access-provider";
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

  it("refreshes independently at quota reset and paid-through boundaries", () => {
    const now = Date.parse("2026-08-31T23:59:55.000Z");
    expect(accessBoundaryRefreshDelays({ quotaResetsAt: "2026-09-01T00:00:00.000Z", paidThrough: "2027-08-01T00:00:00.000Z" }, now)).toEqual([6_000, 2_147_000_000]);
  });

  it("does not schedule a zero-delay timer for boundaries already in the past", () => {
    const now = Date.parse("2026-09-05T12:00:05.000Z");
    expect(accessBoundaryRefreshDelays({ quotaResetsAt: "2026-09-05T12:00:00.000Z", paidThrough: "2026-09-05T12:00:00.000Z" }, now)).toEqual([]);
  });

  it("uses bounded renewal reconciliation polling", () => {
    expect(renewalReconciliationDelays()).toEqual([2_000, 5_000, 10_000, 15_000, 30_000, 30_000]);
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
