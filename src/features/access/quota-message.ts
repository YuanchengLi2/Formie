type QuotaLifecycle = "active_renewing" | "active_cancelled" | "renewal_pending" | "expired" | "not_subscribed" | "unknown";

function exactBillingTime(value: string | null, locale?: string, timeZone?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const zone = timeZone ? { timeZone } : {};
  const date = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", year: "numeric", ...zone }).format(parsed);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZoneName: "short", ...zone }).format(parsed);
  return `${date} at ${time}`;
}

export function formatQuotaTitle(lifecycleState: QuotaLifecycle, paidThrough: string | null, locale?: string, timeZone?: string): string {
  if (lifecycleState !== "active_cancelled") return "Monthly analyses used";
  const accessEnds = exactBillingTime(paidThrough, locale, timeZone);
  return accessEnds ? `Access ends ${accessEnds}` : "Access ending";
}

export function formatQuotaMessage({
  lifecycleState,
  limit,
  resetsAt,
  paidThrough,
  locale,
  timeZone,
}: {
  lifecycleState: QuotaLifecycle;
  limit: number | null;
  resetsAt: string | null;
  paidThrough: string | null;
  locale?: string;
  timeZone?: string;
}): string {
  const allowance = limit == null ? "your included analyses" : `${limit} analyses`;
  const exactTime = (value: string | null) => exactBillingTime(value, locale, timeZone);
  if (lifecycleState === "active_cancelled") {
    const accessEnds = exactTime(paidThrough);
    return `You've used ${allowance} for this period. ${accessEnds ? `Your access ends ${accessEnds}. ` : "Your access remains available through the paid period. "}Resuming renewal does not refill the current period.`;
  }
  if (!resetsAt) return `You've used ${allowance} for this month. You can record again in your next monthly period.`;
  const reset = exactTime(resetsAt);
  if (!reset) return `You've used ${allowance} for this month. You can record again in your next monthly period.`;
  return `You've used ${allowance} for this month. Your analyses reset on ${reset}.`;
}
