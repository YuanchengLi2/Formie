import { resolveSubscriptionView } from "./subscription-view";

describe("subscription entry state", () => {
  it("routes active paid-through accounts out of the purchase entry", () => {
    expect(resolveSubscriptionView("active", "active_cancelled", 4)).toMatchObject({ mode: "completed_account" });
    expect(resolveSubscriptionView("active", "active_renewing", 0)).toMatchObject({ mode: "completed_account" });
  });

  it("routes expired accounts to the repurchase paywall", () => {
    expect(resolveSubscriptionView("expired", "expired", 0)).toMatchObject({ mode: "paywall" });
  });

  it("does not turn an unresolved provider state into expiry", () => {
    expect(resolveSubscriptionView("unknown", "renewal_pending", null)).toMatchObject({ mode: "verify" });
  });
});
