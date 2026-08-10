import { formatBillingTimestamp } from "@/features/access/account-access";

export function subscriptionManagementCopy(lifecycleState: string, paidThrough: string | null) {
  const boundary = formatBillingTimestamp(paidThrough);
  if (lifecycleState === "active_cancelled") return {
    title: "Automatic renewal is off",
    detail: `Your current access and analysis balance remain available until ${boundary}. Use Apple to resume renewal before then.`,
  };
  if (lifecycleState === "renewal_pending") return {
    title: "Checking the next billing period",
    detail: "Formie is reconciling the latest subscription state with Apple. Your last confirmed access remains available during this check.",
  };
  return {
    title: "Automatic renewal is on",
    detail: `Apple currently reports this subscription as renewing. The next paid-through boundary is ${boundary}.`,
  };
}
