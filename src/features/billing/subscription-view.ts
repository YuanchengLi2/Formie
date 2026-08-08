import type { AccessStatus } from "@/features/access/types";

export type SubscriptionView = {
  mode: "verify" | "paywall" | "active_renewing" | "active_cancelled";
  quotaExhausted: boolean;
  planChange: "annual" | null;
  dateKind: "verify" | "repurchase" | "next_billing" | "access_ends";
  primaryAction: "verify" | "repurchase" | "manage" | "resume";
};

export function resolveSubscriptionView(
  accessStatus: AccessStatus["status"],
  lifecycleState: AccessStatus["lifecycleState"],
  remaining: number | null,
  planCode: AccessStatus["planCode"] = null,
  annualAvailable = false,
): SubscriptionView {
  if (accessStatus === "unknown") return { mode: "verify", quotaExhausted: false, planChange: null, dateKind: "verify", primaryAction: "verify" };
  if (accessStatus === "expired") return { mode: "paywall", quotaExhausted: false, planChange: null, dateKind: "repurchase", primaryAction: "repurchase" };
  const cancelled = lifecycleState === "active_cancelled";
  return {
    mode: cancelled ? "active_cancelled" : "active_renewing",
    quotaExhausted: remaining === 0,
    planChange: lifecycleState === "active_renewing" && planCode === "monthly" && annualAvailable ? "annual" : null,
    dateKind: cancelled ? "access_ends" : "next_billing",
    primaryAction: cancelled ? "resume" : "manage",
  };
}
