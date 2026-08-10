import { subscriptionManagementCopy } from "@/features/billing/subscription-management";

describe("native subscription management copy", () => {
  it("distinguishes cancellation from renewal without changing the paid-through period", () => {
    expect(subscriptionManagementCopy("active_cancelled", "2026-08-11T02:34:50Z")).toMatchObject({ title: "Automatic renewal is off" });
    expect(subscriptionManagementCopy("active_renewing", "2026-08-11T02:34:50Z")).toMatchObject({ title: "Automatic renewal is on" });
  });

  it("describes provider reconciliation at the renewal boundary", () => {
    expect(subscriptionManagementCopy("renewal_pending", "2026-08-11T02:34:50Z")).toMatchObject({ title: "Checking the next billing period" });
  });
});
