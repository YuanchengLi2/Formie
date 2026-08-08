import { resolveSubscriptionView } from "./subscription-view";

describe("subscription screen state", () => {
  it("keeps paid-through cancellation active and distinguishes zero quota from expiry", () => {
    expect(resolveSubscriptionView("active", "active_cancelled", 4)).toMatchObject({ mode: "active_cancelled", quotaExhausted: false, dateKind: "access_ends", primaryAction: "resume" });
    expect(resolveSubscriptionView("active", "active_cancelled", 0)).toMatchObject({ mode: "active_cancelled", quotaExhausted: true, dateKind: "access_ends", primaryAction: "resume" });
    expect(resolveSubscriptionView("active", "active_renewing", 0)).toMatchObject({ mode: "active_renewing", quotaExhausted: true, dateKind: "next_billing", primaryAction: "manage" });
    expect(resolveSubscriptionView("expired", "expired", 0)).toMatchObject({ mode: "paywall", quotaExhausted: false, dateKind: "repurchase", primaryAction: "repurchase" });
  });

  it("does not turn an unresolved provider state into expiry", () => {
    expect(resolveSubscriptionView("unknown", "renewal_pending", null)).toMatchObject({ mode: "verify", quotaExhausted: false, dateKind: "verify", primaryAction: "verify" });
  });

  it("offers an annual upgrade to an active monthly subscriber when the store package exists", () => {
    expect(resolveSubscriptionView("active", "active_renewing", 6, "monthly", true)).toMatchObject({ planChange: "annual" });
    expect(resolveSubscriptionView("active", "active_cancelled", 6, "monthly", true)).toMatchObject({ planChange: null });
    expect(resolveSubscriptionView("active", "active_renewing", 6, "annual", true)).toMatchObject({ planChange: null });
  });
});
