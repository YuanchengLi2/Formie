import { resolveBillingBoundary } from "./billing-boundary";

describe("resolveBillingBoundary", () => {
  it("shows a second-accurate renewal countdown and exact local timezone", () => {
    expect(resolveBillingBoundary({ lifecycleState: "active_renewing", willRenew: true, paidThrough: "2026-08-11T02:34:50Z", sandbox: true }, new Date("2026-08-11T02:30:18Z"), "en-US", "America/New_York")).toMatchObject({
      relativeCountdown: "Renews in 4m 32s",
      exactTimestamp: "Aug 10, 2026 at 10:34 PM EDT",
      timeZone: "America/New_York",
      boundaryVerb: "Renews",
      reconciliationState: "stable",
    });
  });

  it("uses access-end language for a canceled paid-through period", () => {
    expect(resolveBillingBoundary({ lifecycleState: "active_cancelled", willRenew: false, paidThrough: "2026-08-11T02:34:50Z", sandbox: true }, new Date("2026-08-11T02:34:20Z"), "en-US", "UTC")).toMatchObject({ relativeCountdown: "Access ends in 30s", boundaryVerb: "Access ends" });
  });

  it("shows Checking Apple only inside the 90-second renewal window", () => {
    const input = { lifecycleState: "renewal_pending" as const, willRenew: true, paidThrough: "2026-08-11T02:34:50Z", sandbox: true };
    expect(resolveBillingBoundary(input, new Date("2026-08-11T02:35:20Z"), "en-US", "UTC")).toMatchObject({ relativeCountdown: "Checking Apple…", reconciliationState: "checking" });
    expect(resolveBillingBoundary(input, new Date("2026-08-11T02:36:21Z"), "en-US", "UTC")).toMatchObject({ relativeCountdown: "Apple update delayed", reconciliationState: "provider_delayed" });
  });
});
