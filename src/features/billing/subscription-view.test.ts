import { resolveSubscriptionView } from "./subscription-view";

describe("subscription screen state", () => {
  it("keeps paid-through cancellation active and distinguishes zero quota from expiry", () => {
    expect(resolveSubscriptionView("active", 4, { isActive: true, willRenew: false })).toEqual({ mode: "active_cancelled", quotaExhausted: false });
    expect(resolveSubscriptionView("active", 0, { isActive: true, willRenew: false })).toEqual({ mode: "active_cancelled", quotaExhausted: true });
    expect(resolveSubscriptionView("active", 0, { isActive: true, willRenew: true })).toEqual({ mode: "active_renewing", quotaExhausted: true });
    expect(resolveSubscriptionView("expired", 0, null)).toEqual({ mode: "paywall", quotaExhausted: false });
  });

  it("does not turn an unresolved provider state into expiry", () => {
    expect(resolveSubscriptionView("unknown", null, null)).toEqual({ mode: "verify", quotaExhausted: false });
  });
});
