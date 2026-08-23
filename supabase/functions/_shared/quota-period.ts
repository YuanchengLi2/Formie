import type { SubscriptionPlanCode } from "./subscription-state.ts";

export type QuotaPeriodInput = {
  planCode: SubscriptionPlanCode;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  sandbox: boolean;
  store: string | null;
};

function iso(value: number): string { return new Date(value).toISOString(); }

function addUtcMonthsFromAnchor(anchor: Date, months: number): Date {
  const year = anchor.getUTCFullYear();
  const monthIndex = anchor.getUTCMonth() + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(anchor.getUTCDate(), lastDay),
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds(),
  ));
}

export function resolveQuotaPeriod(input: QuotaPeriodInput, now = new Date()): { startsAt: string; endsAt: string } {
  const start = new Date(input.billingPeriodStart);
  const end = new Date(input.billingPeriodEnd);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const nowMs = Math.min(Math.max(now.getTime(), startMs), endMs);
  if (input.planCode === "monthly") return { startsAt: start.toISOString(), endsAt: end.toISOString() };

  if (input.sandbox && input.store === "test_store") {
    const windowMs = 5 * 60 * 1000;
    const index = Math.max(0, Math.floor((Math.max(startMs, nowMs) - startMs) / windowMs));
    const periodStart = Math.min(startMs + index * windowMs, Math.max(startMs, endMs - windowMs));
    return { startsAt: iso(periodStart), endsAt: iso(Math.min(periodStart + windowMs, endMs)) };
  }

  let month = 0;
  while (month < 12 && addUtcMonthsFromAnchor(start, month + 1).getTime() <= nowMs) month += 1;
  const periodStart = addUtcMonthsFromAnchor(start, month).getTime();
  const periodEnd = Math.min(addUtcMonthsFromAnchor(start, month + 1).getTime(), endMs);
  return { startsAt: iso(periodStart), endsAt: iso(periodEnd) };
}
