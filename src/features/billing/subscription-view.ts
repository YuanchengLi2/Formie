import type { AccessStatus } from "@/features/access/types";

export type SubscriptionView = { mode: "verify" | "paywall" | "active_renewing" | "active_cancelled"; quotaExhausted: boolean };

export function resolveSubscriptionView(
  accessStatus: AccessStatus["status"],
  remaining: number | null,
  subscription: { isActive: boolean; willRenew: boolean } | null,
): SubscriptionView {
  if (accessStatus === "unknown") return { mode: "verify", quotaExhausted: false };
  if (accessStatus === "expired") return { mode: "paywall", quotaExhausted: false };
  return { mode: subscription?.willRenew === false ? "active_cancelled" : "active_renewing", quotaExhausted: remaining === 0 };
}
