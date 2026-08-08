import { friendlyPurchaseError } from "./billing-errors";
import { resolveEntitlement } from "./entitlement-resolution";
import { isCurrentPurchaseOperation, resolvePurchaseOutcome } from "./purchase-reconciliation";
import type { BillingCustomerInfo } from "./types";

const activeCustomer: BillingCustomerInfo = {
  activeEntitlementIds: ["formie_pro"],
  originalAppUserId: "user-1",
  subscription: null,
};

describe("billing provider purchase messaging", () => {
  it("treats a store cancellation as a silent idle return", () => {
    expect(friendlyPurchaseError(new Error("User cancelled purchase"))).toBe("");
  });

  it("does not claim a hard-coded price when the store is unavailable", () => {
    expect(friendlyPurchaseError(new Error("product unavailable"))).toMatch(/not available/i);
  });
});

describe("entitlement resolution", () => {
  it("preserves cancelled access through its paid-through timestamp", () => {
    expect(resolveEntitlement({ isActive: true, willRenew: false, expirationDate: "2026-09-01T00:00:00Z" }, Date.parse("2026-08-05T00:00:00Z"))).toBe("active");
  });

  it("confirms expiry only after the provider period ends", () => {
    expect(resolveEntitlement({ isActive: false, willRenew: false, expirationDate: "2026-08-01T00:00:00Z" }, Date.parse("2026-08-05T00:00:00Z"))).toBe("expired");
  });

  it("allows a renewed entitlement to become active after previous expiry", () => {
    expect(resolveEntitlement({ isActive: true, willRenew: true, expirationDate: "2026-09-01T00:00:00Z" }, Date.parse("2026-08-05T00:00:00Z"))).toBe("active");
  });
});

describe("purchase lifecycle reconciliation", () => {
  it("activates only after both CustomerInfo and the server snapshot are active", () => {
    expect(resolvePurchaseOutcome(activeCustomer, "formie_pro", true)).toBe("active");
    expect(resolvePurchaseOutcome(activeCustomer, "formie_pro", false)).toBe("sync_required");
    expect(resolvePurchaseOutcome({ ...activeCustomer, activeEntitlementIds: [] }, "formie_pro", true)).toBe("failed");
  });

  it("keeps late SDK results tied to their original operation", () => {
    expect(isCurrentPurchaseOperation("purchase-2", "purchase-1")).toBe(false);
    expect(isCurrentPurchaseOperation("purchase-2", "purchase-2")).toBe(true);
  });
});
