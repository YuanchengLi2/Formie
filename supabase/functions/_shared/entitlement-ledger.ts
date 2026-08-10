import { planCodeForProduct, resolveRevenueCatEntitlement, resolveSubscriptionState, type RevenueCatSubscriber, type SubscriptionState } from "./revenuecat.ts";
import { reduceSubscriptionState, type SubscriptionLedgerState } from "./subscription-state.ts";

type AccessRow = { status: "active" | "expired"; entitlement_id: string | null; current_period_start: string | null; current_period_end: string | null; store_product_id: string | null; lifecycle_state?: string | null; plan_code?: string | null; store?: string | null; sandbox?: boolean; will_renew?: boolean; billing_period_start?: string | null; billing_period_end?: string | null; latest_event_at?: string | null; latest_revenuecat_event_id?: string | null; state_version?: number };

type LedgerLifecycleEvent = { id: string; type: string; app_user_id: string; product_identifier?: string | null; purchased_at?: string | null; expiration_at?: string | null; event_timestamp?: string | null; environment?: string; entitlement_ids?: string[]; cancel_reason?: string | null };

function sameTimestamp(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return !left && !right;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) ? leftTime === rightTime : left === right;
}

function sameLedgerState(existing: AccessRow, next: AccessRow): boolean {
  return existing.status === next.status
    && existing.entitlement_id === next.entitlement_id
    && existing.store_product_id === next.store_product_id
    && existing.lifecycle_state === next.lifecycle_state
    && existing.plan_code === next.plan_code
    && (existing.store ?? null) === (next.store ?? null)
    && existing.sandbox === next.sandbox
    && existing.will_renew === next.will_renew
    && sameTimestamp(existing.current_period_start, next.current_period_start)
    && sameTimestamp(existing.current_period_end, next.current_period_end)
    && sameTimestamp(existing.billing_period_start, next.billing_period_start)
    && sameTimestamp(existing.billing_period_end, next.billing_period_end);
}

export function lifecycleEventLedgerPatch(row: AccessRow, event: LedgerLifecycleEvent): Record<string, unknown> {
  const current: SubscriptionLedgerState = {
    lifecycleState: row.lifecycle_state === "active_renewing" || row.lifecycle_state === "active_cancelled" || row.lifecycle_state === "renewal_pending" || row.lifecycle_state === "not_subscribed" ? row.lifecycle_state : row.status === "active" ? "active_renewing" : "expired",
    productIdentifier: row.store_product_id,
    planCode: row.plan_code === "annual" ? "annual" : row.plan_code === "monthly" ? "monthly" : planCodeForProduct(row.store_product_id),
    store: row.store ?? null,
    sandbox: row.sandbox === true,
    willRenew: row.will_renew === true,
    billingPeriodStart: row.billing_period_start ?? row.current_period_start,
    billingPeriodEnd: row.billing_period_end ?? row.current_period_end,
    latestEventAt: row.latest_event_at ?? null,
    latestEventId: row.latest_revenuecat_event_id ?? null,
  };
  const reduced = reduceSubscriptionState(current, {
    id: event.id,
    type: event.type as never,
    eventAt: event.event_timestamp ?? new Date().toISOString(),
    productIdentifier: event.product_identifier ?? current.productIdentifier,
    purchasedAt: event.purchased_at ?? null,
    expiresAt: event.expiration_at ?? null,
    planCode: planCodeForProduct(event.product_identifier ?? current.productIdentifier),
    store: current.store,
    sandbox: event.environment === "SANDBOX" ? true : current.sandbox,
  });
  return {
    status: reduced.lifecycleState === "expired" || reduced.lifecycleState === "not_subscribed" ? "expired" : "active",
    lifecycle_state: reduced.lifecycleState,
    store_product_id: reduced.productIdentifier,
    plan_code: reduced.planCode,
    store: reduced.store,
    sandbox: reduced.sandbox,
    will_renew: reduced.willRenew,
    billing_period_start: reduced.billingPeriodStart,
    billing_period_end: reduced.billingPeriodEnd,
    current_period_start: reduced.billingPeriodStart,
    current_period_end: reduced.billingPeriodEnd,
    latest_event_at: reduced.latestEventAt,
    latest_revenuecat_event_id: reduced.latestEventId,
    state_version: Number(row.state_version ?? 0) + (reduced === current ? 0 : 1),
    updated_at: new Date().toISOString(),
  };
}

export async function applyRevenueCatLifecycleEvent(admin: any, userId: string, event: LedgerLifecycleEvent): Promise<void> {
  const { data: existing, error } = await admin.from("user_access_entitlements")
    .select("status,entitlement_id,current_period_start,current_period_end,store_product_id,lifecycle_state,plan_code,store,sandbox,will_renew,billing_period_start,billing_period_end,latest_event_at,latest_revenuecat_event_id,state_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!existing) return;
  const patch = lifecycleEventLedgerPatch(existing as AccessRow, event);
  const { error: updateError } = await admin.from("user_access_entitlements").update(patch).eq("user_id", userId);
  if (updateError) throw updateError;
  const { error: eventError } = await admin.from("revenuecat_webhook_events").update({
    product_identifier: event.product_identifier ?? null,
    purchased_at: event.purchased_at ?? null,
    expiration_at: event.expiration_at ?? null,
    environment: event.environment ?? null,
    entitlement_identifiers: event.entitlement_ids ?? [],
    cancel_reason: event.cancel_reason ?? null,
    event_timestamp: event.event_timestamp ?? null,
  }).eq("event_id", event.id);
  if (eventError) throw eventError;
  if (event.type === "RENEWAL") {
    await clearSupersededTestScenario(admin, userId, event.expiration_at);
  } else if (["INITIAL_PURCHASE", "PRODUCT_CHANGE", "TRANSFER", "UNCANCELLATION"].includes(event.type)) {
    await clearSubscriptionTestScenario(admin, userId);
  }
}

export async function persistEntitlementLedger(admin: any, userId: string, subscriber: RevenueCatSubscriber, entitlementId = "formie_pro", now = new Date(), preserveLatestEvent = false): Promise<AccessRow> {
  const entitlement = resolveRevenueCatEntitlement(subscriber, entitlementId, now);
  const subscriptionState = resolveSubscriptionState(subscriber, now, entitlementId);
  if (entitlement.status === "active") {
    const start = entitlement.purchaseDate ? new Date(entitlement.purchaseDate).getTime() : Number.NaN;
    const end = entitlement.expirationDate ? new Date(entitlement.expirationDate).getTime() : Number.NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error("RevenueCat returned an invalid active billing period");
  }
  const { data: existing, error: existingError } = await admin.from("user_access_entitlements")
    .select("status,entitlement_id,current_period_start,current_period_end,store_product_id,lifecycle_state,plan_code,store,sandbox,will_renew,billing_period_start,billing_period_end,latest_event_at,latest_revenuecat_event_id,state_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;
  const existingEnd = existing?.current_period_end ? new Date(existing.current_period_end).getTime() : Number.NaN;
  const incomingEnd = entitlement.expirationDate ? new Date(entitlement.expirationDate).getTime() : Number.NaN;
  if (existing && Number.isFinite(existingEnd) && existingEnd > now.getTime() && (!Number.isFinite(incomingEnd) || incomingEnd < existingEnd)) {
    return existing as AccessRow;
  }
  const subscription = (subscriber.subscriptions ?? []).find((item) => item.productIdentifier === entitlement.productIdentifier) ?? null;
  const billingStart = subscription?.purchaseDate ?? entitlement.purchaseDate;
  const billingEnd = subscription?.expirationDate ?? entitlement.expirationDate;
  const preserveEventState = Boolean(preserveLatestEvent && existing?.latest_event_at && sameTimestamp(existing.billing_period_end, billingEnd));
  const nextState: AccessRow = {
    status: entitlement.status,
    entitlement_id: entitlement.entitlementId,
    current_period_start: billingStart,
    current_period_end: billingEnd,
    store_product_id: entitlement.productIdentifier,
    lifecycle_state: preserveEventState ? existing.lifecycle_state : subscriptionState.state,
    plan_code: subscriptionState.planCode,
    store: subscriptionState.store,
    sandbox: subscriptionState.sandbox,
    will_renew: preserveEventState ? existing.will_renew : subscriptionState.willRenew,
    billing_period_start: billingStart,
    billing_period_end: billingEnd,
    latest_event_at: existing?.latest_event_at ?? null,
    latest_revenuecat_event_id: existing?.latest_revenuecat_event_id ?? null,
    state_version: Number(existing?.state_version ?? 0),
  };
  if (entitlement.status === "active" && subscriptionState.store === "test_store" && subscriptionState.sandbox) {
    await clearSupersededTestScenario(admin, userId, billingEnd);
  }
  if (existing && sameLedgerState(existing as AccessRow, nextState)) return existing as AccessRow;
  const { data, error } = await admin.from("user_access_entitlements").upsert({
    user_id: userId,
    status: entitlement.status,
    entitlement_id: entitlement.entitlementId,
    revenuecat_app_user_id: userId,
    store_product_id: entitlement.productIdentifier,
    current_period_start: billingStart,
    current_period_end: billingEnd,
    lifecycle_state: preserveEventState ? existing.lifecycle_state : subscriptionState.state,
    plan_code: subscriptionState.planCode,
    store: subscriptionState.store,
    sandbox: subscriptionState.sandbox,
    will_renew: preserveEventState ? existing.will_renew : subscriptionState.willRenew,
    billing_period_start: billingStart,
    billing_period_end: billingEnd,
    state_version: nextState.state_version! + 1,
    last_reconciled_at: now.toISOString(),
    last_customer_info: {
      appUserId: subscriber.appUserId,
      managementUrl: subscriber.managementUrl ?? null,
      activeEntitlementIds: subscriber.entitlements.filter((item) => activeAt(item.expirationDate, now)).map((item) => item.identifier),
      subscription: subscription ? { productIdentifier: subscription.productIdentifier, store: subscription.store, purchaseDate: subscription.purchaseDate ?? null, originalPurchaseDate: subscription.originalPurchaseDate ?? null, expirationDate: subscription.expirationDate, unsubscribeDetectedAt: subscription.unsubscribeDetectedAt, ownershipType: subscription.ownershipType ?? null, sandbox: subscription.sandbox } : null,
    },
    updated_at: now.toISOString(),
  }, { onConflict: "user_id" }).select("status,entitlement_id,current_period_start,current_period_end,store_product_id,lifecycle_state,plan_code,store,sandbox,will_renew,billing_period_start,billing_period_end,latest_event_at,latest_revenuecat_event_id,state_version").single();
  if (error || !data) throw error ?? new Error("Access status could not be saved");
  const newPurchaseOrProductChange = Boolean(existing && (
    (existing.status !== "active" && entitlement.status === "active")
    || existing.store_product_id !== entitlement.productIdentifier
  ));
  if (newPurchaseOrProductChange) await clearSubscriptionTestScenario(admin, userId);
  return data as AccessRow;
}

async function clearSubscriptionTestScenario(admin: any, userId: string): Promise<void> {
  const query = admin.from("subscription_test_scenarios");
  if (!query || typeof query.delete !== "function") return;
  const { error } = await query.delete().eq("user_id", userId);
  if (error) throw error;
}

async function clearSupersededTestScenario(admin: any, userId: string, providerPeriodEnd: string | null | undefined): Promise<void> {
  const providerEnd = providerPeriodEnd ? new Date(providerPeriodEnd).getTime() : Number.NaN;
  if (!Number.isFinite(providerEnd)) return;

  const query = admin.from("subscription_test_scenarios");
  if (!query || typeof query.select !== "function") return;
  const { data: scenario, error } = await query
    .select("lifecycle_state,billing_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!scenario || scenario.lifecycle_state === "active_cancelled") return;

  const scenarioEnd = typeof scenario.billing_period_end === "string"
    ? new Date(scenario.billing_period_end).getTime()
    : Number.NaN;
  if (!Number.isFinite(scenarioEnd) || providerEnd <= scenarioEnd) return;

  const { error: deleteError } = await admin.from("subscription_test_scenarios")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;
}

function activeAt(expiration: string | null, now: Date): boolean { return expiration === null || new Date(expiration).getTime() > now.getTime(); }
