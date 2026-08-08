import type { AccessStatus } from "@/features/access/types";

export type SubscriptionView = {
  mode: "verify" | "paywall" | "completed_account";
};

export function resolveSubscriptionView(
  accessStatus: AccessStatus["status"],
  _lifecycleState: AccessStatus["lifecycleState"],
  _remaining: number | null,
): SubscriptionView {
  if (accessStatus === "unknown") return { mode: "verify" };
  if (accessStatus === "expired") return { mode: "paywall" };
  return { mode: "completed_account" };
}
