import type { BillingCustomerInfo, BillingSubscription } from "./types";

export function customerHasEntitlement(customerInfo: BillingCustomerInfo, entitlementId: string): boolean {
  return customerInfo.activeEntitlementIds.includes(entitlementId);
}

type EntitlementLike = {
  identifier: string;
  productIdentifier: string;
  isActive: boolean;
  willRenew: boolean;
  expirationDate: string | Date | null;
  isSandbox: boolean;
  store: string;
};

export function subscriptionFromEntitlement(entitlement: EntitlementLike, managementURL: string | null): BillingSubscription {
  return {
    entitlementId: entitlement.identifier,
    productIdentifier: entitlement.productIdentifier,
    isActive: entitlement.isActive,
    willRenew: entitlement.willRenew,
    expirationDate: entitlement.expirationDate instanceof Date ? entitlement.expirationDate.toISOString() : entitlement.expirationDate,
    managementURL,
    isSandbox: entitlement.isSandbox,
    store: entitlement.store,
  };
}
