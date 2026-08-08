import type { BillingCustomerInfo, PurchaseOutcome } from "./types";

export type ReconciliationSnapshot = {
  providerActive: boolean;
  serverActive: boolean;
  customerInfo: BillingCustomerInfo | null;
  providerProductIdentifier: string | null;
  serverProductIdentifier: string | null;
};

export function resolvePurchaseOutcome(customerInfo: BillingCustomerInfo, entitlementId: string, serverActive: boolean): PurchaseOutcome {
  if (!customerInfo.activeEntitlementIds.includes(entitlementId)) return "failed";
  return serverActive ? "active" : "sync_required";
}

export function isCurrentPurchaseOperation(currentOperationId: string | null, resultOperationId: string): boolean {
  return currentOperationId !== null && currentOperationId === resultOperationId;
}

export function createPurchaseOperationId(now = Date.now(), random = Math.random()): string {
  return `${now}-${random.toString(36).slice(2)}`;
}
