import { resolveRevenueCatEntitlement, type RevenueCatSubscriber } from "./revenuecat.ts";

type AccessRow = { status: "active" | "expired"; entitlement_id: string | null; current_period_start: string | null; current_period_end: string | null; store_product_id: string | null };

export async function persistEntitlementLedger(admin: any, userId: string, subscriber: RevenueCatSubscriber, entitlementId = "formie_pro", now = new Date()): Promise<AccessRow> {
  const entitlement = resolveRevenueCatEntitlement(subscriber, entitlementId, now);
  if (entitlement.status === "active") {
    const start = entitlement.purchaseDate ? new Date(entitlement.purchaseDate).getTime() : Number.NaN;
    const end = entitlement.expirationDate ? new Date(entitlement.expirationDate).getTime() : Number.NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) throw new Error("RevenueCat returned an invalid active billing period");
  }
  const { data: existing, error: existingError } = await admin.from("user_access_entitlements")
    .select("status,entitlement_id,current_period_start,current_period_end,store_product_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;
  const existingEnd = existing?.current_period_end ? new Date(existing.current_period_end).getTime() : Number.NaN;
  const incomingEnd = entitlement.expirationDate ? new Date(entitlement.expirationDate).getTime() : Number.NaN;
  if (existing && Number.isFinite(existingEnd) && existingEnd > now.getTime() && (!Number.isFinite(incomingEnd) || incomingEnd < existingEnd)) {
    return existing as AccessRow;
  }
  const subscription = (subscriber.subscriptions ?? []).find((item) => item.productIdentifier === entitlement.productIdentifier) ?? null;
  const { data, error } = await admin.from("user_access_entitlements").upsert({
    user_id: userId,
    status: entitlement.status,
    entitlement_id: entitlement.entitlementId,
    revenuecat_app_user_id: userId,
    store_product_id: entitlement.productIdentifier,
    current_period_start: entitlement.purchaseDate,
    current_period_end: entitlement.expirationDate,
    last_reconciled_at: now.toISOString(),
    last_customer_info: {
      appUserId: subscriber.appUserId,
      managementUrl: subscriber.managementUrl ?? null,
      activeEntitlementIds: subscriber.entitlements.filter((item) => activeAt(item.expirationDate, now)).map((item) => item.identifier),
      subscription: subscription ? { productIdentifier: subscription.productIdentifier, store: subscription.store, expirationDate: subscription.expirationDate, unsubscribeDetectedAt: subscription.unsubscribeDetectedAt, sandbox: subscription.sandbox } : null,
    },
    updated_at: now.toISOString(),
  }, { onConflict: "user_id" }).select("status,entitlement_id,current_period_start,current_period_end,store_product_id").single();
  if (error || !data) throw error ?? new Error("Access status could not be saved");
  return data as AccessRow;
}

function activeAt(expiration: string | null, now: Date): boolean { return expiration === null || new Date(expiration).getTime() > now.getTime(); }
