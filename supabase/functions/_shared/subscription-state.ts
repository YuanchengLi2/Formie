export type SubscriptionLifecycleState = "active_renewing" | "active_cancelled" | "renewal_pending" | "expired" | "not_subscribed";
export type SubscriptionPlanCode = "monthly" | "annual";

export type SubscriptionLedgerState = {
  lifecycleState: SubscriptionLifecycleState;
  productIdentifier: string | null;
  planCode: SubscriptionPlanCode | null;
  store: string | null;
  sandbox: boolean;
  willRenew: boolean;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  latestEventAt: string | null;
  latestEventId: string | null;
  providerOriginalTransactionId?: string | null;
};

export type SubscriptionLifecycleEvent = {
  id: string;
  type: "INITIAL_PURCHASE" | "RENEWAL" | "CANCELLATION" | "UNCANCELLATION" | "BILLING_ISSUE" | "PRODUCT_CHANGE" | "EXPIRATION" | "TRANSFER" | "TEST";
  eventAt: string;
  productIdentifier?: string | null;
  purchasedAt?: string | null;
  expiresAt?: string | null;
  planCode?: SubscriptionPlanCode | null;
  store?: string | null;
  sandbox?: boolean;
  originalTransactionId?: string | null;
};

function time(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

function withEvent(state: SubscriptionLedgerState, event: SubscriptionLifecycleEvent): SubscriptionLedgerState {
  return { ...state, latestEventAt: event.eventAt, latestEventId: event.id };
}

export function reduceSubscriptionState(current: SubscriptionLedgerState, event: SubscriptionLifecycleEvent): SubscriptionLedgerState {
  const currentEventAt = time(current.latestEventAt);
  const incomingEventAt = time(event.eventAt);
  if (Number.isFinite(currentEventAt) && Number.isFinite(incomingEventAt) && incomingEventAt < currentEventAt
    && current.providerOriginalTransactionId
    && event.originalTransactionId === current.providerOriginalTransactionId) return current;
  if (current.productIdentifier && event.productIdentifier && current.productIdentifier !== event.productIdentifier && event.type !== "PRODUCT_CHANGE" && event.type !== "INITIAL_PURCHASE") return current;

  if (event.type === "CANCELLATION") {
    if (current.lifecycleState === "expired" || current.lifecycleState === "not_subscribed") return current;
    return withEvent({ ...current, lifecycleState: "active_cancelled", willRenew: false }, event);
  }
  if (event.type === "UNCANCELLATION") {
    if (current.lifecycleState === "expired" || current.lifecycleState === "not_subscribed") return current;
    return withEvent({ ...current, lifecycleState: "active_renewing", willRenew: true }, event);
  }
  if (event.type === "BILLING_ISSUE") {
    if (current.lifecycleState === "expired" || current.lifecycleState === "not_subscribed") return withEvent(current, event);
    return withEvent({ ...current, lifecycleState: "renewal_pending" }, event);
  }
  if (event.type === "PRODUCT_CHANGE") return withEvent(current, event);
  if (event.type === "EXPIRATION") {
    const currentEnd = time(current.billingPeriodEnd);
    const expiredEnd = time(event.expiresAt);
    if (Number.isFinite(currentEnd) && Number.isFinite(expiredEnd) && expiredEnd < currentEnd) return current;
    return withEvent({ ...current, lifecycleState: "expired", willRenew: false }, event);
  }
  if (event.type === "INITIAL_PURCHASE" || event.type === "RENEWAL") {
    if (!event.purchasedAt || !event.expiresAt || time(event.purchasedAt) >= time(event.expiresAt)) return current;
    return withEvent({
      ...current,
      lifecycleState: "active_renewing",
      productIdentifier: event.productIdentifier ?? current.productIdentifier,
      planCode: event.planCode ?? current.planCode,
      store: event.store ?? current.store,
      sandbox: event.sandbox ?? current.sandbox,
      willRenew: true,
      billingPeriodStart: event.purchasedAt,
      billingPeriodEnd: event.expiresAt,
      providerOriginalTransactionId: event.originalTransactionId ?? current.providerOriginalTransactionId ?? null,
    }, event);
  }
  return withEvent(current, event);
}

export function resolveRenewalBoundaryState(current: SubscriptionLedgerState, now = new Date(), reconciliationWindowMs = 90_000): SubscriptionLifecycleState {
  const periodEnd = time(current.billingPeriodEnd);
  if (!Number.isFinite(periodEnd) || now.getTime() < periodEnd) return current.lifecycleState;
  if (current.willRenew && now.getTime() <= periodEnd + reconciliationWindowMs) return "renewal_pending";
  return "expired";
}
