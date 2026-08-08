import { resolvePurchaseOutcome, isCurrentPurchaseOperation } from "./purchase-reconciliation";
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
});
