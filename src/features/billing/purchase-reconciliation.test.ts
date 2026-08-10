import { resolvePurchaseOutcome, isCurrentPurchaseOperation, resolvePassiveBillingState, resolvePassiveBillingStateFromSnapshot, resolveServerProductIdentifier } from "./purchase-reconciliation";
import type { BillingCustomerInfo } from "./types";

const customerInfo: BillingCustomerInfo = {
  activeEntitlementIds: ["formie_pro"],
  originalAppUserId: "user-1",
  subscription: null,
};

describe("purchase reconciliation", () => {
  it("activates only when both RevenueCat and the server confirm access", () => {
    expect(resolvePurchaseOutcome(customerInfo, "formie_pro", true)).toBe("active");
    expect(resolvePurchaseOutcome(customerInfo, "formie_pro", false)).toBe("sync_required");
    expect(resolvePurchaseOutcome({ ...customerInfo, activeEntitlementIds: [] }, "formie_pro", false)).toBe("failed");
  });

  it("rejects late results from a previous purchase operation", () => {
    expect(isCurrentPurchaseOperation("operation-2", "operation-1")).toBe(false);
    expect(isCurrentPurchaseOperation("operation-2", "operation-2")).toBe(true);
  });

  it("falls back to the fresh access product when the subscription envelope omits it", () => {
    expect(resolveServerProductIdentifier(null, "formie_monthly")).toBe("formie_monthly");
    expect(resolveServerProductIdentifier("formie_monthly", "formie_yearly")).toBe("formie_monthly");
  });

  it("keeps checkout ready when passive provider state conflicts with an authoritative expired account", () => {
    expect(resolvePassiveBillingState({ providerActive: true, serverLifecycleState: "expired", offeringAvailable: true })).toBe("ready");
    expect(resolvePassiveBillingState({ providerActive: true, serverLifecycleState: "not_subscribed", offeringAvailable: true })).toBe("ready");
  });

  it("blocks checkout only while an active provider entitlement is genuinely unresolved", () => {
    expect(resolvePassiveBillingState({ providerActive: true, serverLifecycleState: "renewal_pending", offeringAvailable: true })).toBe("sync_required");
    expect(resolvePassiveBillingState({ providerActive: true, serverLifecycleState: "unknown", offeringAvailable: true })).toBe("sync_required");
    expect(resolvePassiveBillingState({ providerActive: false, serverLifecycleState: "expired", offeringAvailable: false })).toBe("failed");
  });

  it("uses the lifecycle returned by the same server refresh instead of stale context state", () => {
    expect(resolvePassiveBillingStateFromSnapshot({
      providerActive: true,
      serverActive: false,
      serverLifecycleState: "expired",
      customerInfo,
      providerProductIdentifier: "formie_monthly",
      serverProductIdentifier: "formie_monthly",
    }, true)).toBe("ready");
  });
});
