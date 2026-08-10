import type { BillingCustomerInfo, PurchaseOutcome } from "./types";
import type { SubscriptionLifecycleState } from "../access/types";

export type ReconciliationSnapshot = {
  providerActive: boolean;
  serverActive: boolean;
  serverLifecycleState: SubscriptionLifecycleState;
  customerInfo: BillingCustomerInfo | null;
  providerProductIdentifier: string | null;
  serverProductIdentifier: string | null;
};

export type PassiveBillingState = "ready" | "sync_required" | "failed";

export function resolvePassiveBillingState(input: {
  providerActive: boolean;
  serverLifecycleState: SubscriptionLifecycleState;
  offeringAvailable: boolean;
}): PassiveBillingState {
  if (!input.offeringAvailable) return "failed";
  if (input.providerActive && (input.serverLifecycleState === "renewal_pending" || input.serverLifecycleState === "unknown")) {
    return "sync_required";
  }
  return "ready";
}

export function resolvePassiveBillingStateFromSnapshot(snapshot: ReconciliationSnapshot, offeringAvailable: boolean): PassiveBillingState {
  return resolvePassiveBillingState({
    providerActive: snapshot.providerActive,
    serverLifecycleState: snapshot.serverLifecycleState,
    offeringAvailable,
  });
}

export function resolveServerProductIdentifier(subscriptionProductIdentifier: string | null, accessProductIdentifier: string | null): string | null {
  return subscriptionProductIdentifier ?? accessProductIdentifier;
}

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
