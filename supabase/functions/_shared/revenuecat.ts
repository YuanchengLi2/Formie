export type RevenueCatEntitlement = { identifier: string; productIdentifier: string | null; purchaseDate: string | null; expirationDate: string | null };
export type RevenueCatSubscription = { productIdentifier: string; store: string | null; expirationDate: string | null; unsubscribeDetectedAt: string | null; sandbox: boolean };
export type RevenueCatSubscriber = { appUserId: string; entitlements: RevenueCatEntitlement[]; subscriptions?: RevenueCatSubscription[]; managementUrl?: string | null };

type RevenueCatPayload = { subscriber?: { management_url?: unknown; entitlements?: Record<string, { product_identifier?: unknown; purchase_date?: unknown; expires_date?: unknown }>; subscriptions?: Record<string, { store?: unknown; expires_date?: unknown; unsubscribe_detected_at?: unknown; is_sandbox?: unknown }> } };
const text = (value: unknown) => typeof value === "string" && value.length > 0 ? value : null;

export function parseRevenueCatSubscriber(appUserId: string, payload: RevenueCatPayload): RevenueCatSubscriber {
  const raw = payload.subscriber;
  return {
    appUserId,
    managementUrl: text(raw?.management_url),
    entitlements: Object.entries(raw?.entitlements ?? {}).map(([identifier, item]) => ({ identifier, productIdentifier: text(item.product_identifier), purchaseDate: text(item.purchase_date), expirationDate: text(item.expires_date) })),
    subscriptions: Object.entries(raw?.subscriptions ?? {}).map(([productIdentifier, item]) => ({ productIdentifier, store: text(item.store), expirationDate: text(item.expires_date), unsubscribeDetectedAt: text(item.unsubscribe_detected_at), sandbox: item.is_sandbox === true })),
  };
}

export function activeRevenueCatEntitlement(subscriber: RevenueCatSubscriber, entitlementId: string, now = new Date()): RevenueCatEntitlement | null {
  const candidate = subscriber.entitlements.find((item) => item.identifier === entitlementId);
  if (!candidate) return null;
  if (candidate.expirationDate) { const expiresAt = new Date(candidate.expirationDate).getTime(); if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return null; }
  return candidate;
}

export type RevenueCatEntitlementSnapshot = { status: "active" | "expired"; entitlementId: string; productIdentifier: string | null; purchaseDate: string | null; expirationDate: string | null };
export function resolveRevenueCatEntitlement(subscriber: RevenueCatSubscriber, entitlementId: string, now = new Date()): RevenueCatEntitlementSnapshot {
  const candidate = subscriber.entitlements.find((item) => item.identifier === entitlementId) ?? null;
  const active = activeRevenueCatEntitlement(subscriber, entitlementId, now);
  return { status: active ? "active" : "expired", entitlementId: candidate?.identifier ?? entitlementId, productIdentifier: candidate?.productIdentifier ?? null, purchaseDate: candidate?.purchaseDate ?? null, expirationDate: candidate?.expirationDate ?? null };
}

export type SubscriptionState = { state: "active_renewing" | "active_cancelled" | "expired" | "not_subscribed"; productIdentifier: string | null; store: string | null; paidThrough: string | null; cancelUrl: string | null; renewalUrl: string | null; sandbox: boolean };
function storeFallback(store: string | null): string | null {
  if (store === "app_store" || store === "mac_app_store") return "https://apps.apple.com/account/subscriptions";
  if (store === "play_store") return "https://play.google.com/store/account/subscriptions";
  return null;
}
export function resolveSubscriptionState(subscriber: RevenueCatSubscriber, now = new Date(), entitlementId = "formie_pro"): SubscriptionState {
  const entitlementProduct = subscriber.entitlements.find((item) => item.identifier === entitlementId)?.productIdentifier ?? null;
  const selected = (entitlementProduct
    ? (subscriber.subscriptions ?? []).find((item) => item.productIdentifier === entitlementProduct) ?? null
    : null)
    ?? [...(subscriber.subscriptions ?? [])].sort((a, b) => (new Date(b.expirationDate ?? 0).getTime() || 0) - (new Date(a.expirationDate ?? 0).getTime() || 0))[0]
    ?? null;
  if (!selected) {
    const historicalEntitlement = [...subscriber.entitlements].sort((a, b) => (new Date(b.expirationDate ?? 0).getTime() || 0) - (new Date(a.expirationDate ?? 0).getTime() || 0))[0] ?? null;
    const entitlementEnd = historicalEntitlement?.expirationDate ? new Date(historicalEntitlement.expirationDate).getTime() : Number.NaN;
    const entitlementActive = Boolean(historicalEntitlement) && (!Number.isFinite(entitlementEnd) || entitlementEnd > now.getTime());
    return {
      state: historicalEntitlement ? (entitlementActive ? "active_renewing" : "expired") : "not_subscribed",
      productIdentifier: historicalEntitlement?.productIdentifier ?? null,
      store: null,
      paidThrough: historicalEntitlement?.expirationDate ?? null,
      cancelUrl: null,
      renewalUrl: null,
      sandbox: false,
    };
  }
  const end = selected.expirationDate ? new Date(selected.expirationDate).getTime() : Number.NaN;
  const active = !Number.isFinite(end) || end > now.getTime();
  const state = active ? (selected.unsubscribeDetectedAt ? "active_cancelled" : "active_renewing") : "expired";
  return { state, productIdentifier: selected.productIdentifier, store: selected.store, paidThrough: selected.expirationDate, cancelUrl: state === "active_renewing" ? subscriber.managementUrl ?? storeFallback(selected.store) : null, renewalUrl: state === "expired" || state === "active_cancelled" ? subscriber.managementUrl ?? storeFallback(selected.store) : null, sandbox: selected.sandbox };
}

export async function fetchRevenueCatSubscriber(appUserId: string, secretApiKey = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? ""): Promise<RevenueCatSubscriber> {
  if (!secretApiKey) throw new Error("REVENUECAT_SECRET_API_KEY is not configured");
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, { headers: { Authorization: `Bearer ${secretApiKey}`, "Content-Type": "application/json" } });
  if (response.status === 404) return { appUserId, entitlements: [], subscriptions: [], managementUrl: null };
  if (!response.ok) throw new Error(`RevenueCat subscriber lookup failed (${response.status})`);
  return parseRevenueCatSubscriber(appUserId, await response.json() as RevenueCatPayload);
}
