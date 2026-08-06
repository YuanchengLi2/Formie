export function formatQuotaMessage({
  limit,
  resetsAt,
  locale,
  timeZone,
}: {
  limit: number | null;
  resetsAt: string | null;
  locale?: string;
  timeZone?: string;
}): string {
  const allowance = limit == null ? "your included analyses" : `${limit} analyses`;
  if (!resetsAt) return `You've used ${allowance} for this month. You can record again in your next monthly period.`;
  const parsed = new Date(resetsAt);
  if (!Number.isFinite(parsed.getTime())) return `You've used ${allowance} for this month. You can record again in your next monthly period.`;
  const reset = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", timeZone }).format(parsed);
  return `You've used ${allowance} for this month. Your analyses reset on ${reset}.`;
}
