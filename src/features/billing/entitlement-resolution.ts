import type { BillingSubscription, EntitlementResolution } from "./types";

export function resolveEntitlement(
  subscription: Pick<BillingSubscription, "isActive" | "willRenew" | "expirationDate"> | null,
  now = Date.now(),
): Extract<EntitlementResolution, "active" | "expired"> {
  if (!subscription) return "expired";
  const paidThrough = subscription.expirationDate ? new Date(subscription.expirationDate).getTime() : Number.NaN;
  if (Number.isFinite(paidThrough) && paidThrough > now) return "active";
  return subscription.isActive && !Number.isFinite(paidThrough) ? "active" : "expired";
}
