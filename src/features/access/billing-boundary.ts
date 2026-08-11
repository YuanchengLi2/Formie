import type { SubscriptionLifecycleState } from "./types";

export type BillingBoundaryInput = {
  lifecycleState: SubscriptionLifecycleState;
  willRenew: boolean;
  paidThrough: string | null;
  sandbox: boolean;
};

export type BillingBoundary = {
  exactTimestamp: string;
  timeZone: string;
  relativeCountdown: string;
  boundaryVerb: "Renews" | "Access ends" | "Access ended" | "Billing";
  reconciliationState: "stable" | "checking" | "expired" | "provider_delayed" | "unavailable";
  remainingMs: number | null;
};

const RECONCILIATION_WINDOW_MS = 90_000;

export function resolveBillingBoundary(
  input: BillingBoundaryInput,
  now = new Date(),
  locale?: string,
  requestedTimeZone?: string,
): BillingBoundary {
  const timeZone = requestedTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const paidThrough = input.paidThrough ? new Date(input.paidThrough) : null;
  const boundaryMs = paidThrough?.getTime() ?? Number.NaN;
  if (!paidThrough || !Number.isFinite(boundaryMs)) {
    return { exactTimestamp: "Billing date unavailable", timeZone, relativeCountdown: "Billing date unavailable", boundaryVerb: "Billing", reconciliationState: "unavailable", remainingMs: null };
  }

  const remainingMs = Math.max(0, boundaryMs - now.getTime());
  const exactTimestamp = formatExactTimestamp(paidThrough, locale, timeZone);
  if (remainingMs > 0) {
    const renewing = input.lifecycleState === "active_renewing" && input.willRenew;
    const boundaryVerb = renewing ? "Renews" : "Access ends";
    return { exactTimestamp, timeZone, relativeCountdown: `${boundaryVerb} in ${formatDuration(remainingMs)}`, boundaryVerb, reconciliationState: "stable", remainingMs };
  }

  const elapsed = now.getTime() - boundaryMs;
  if ((input.lifecycleState === "renewal_pending" || input.willRenew) && elapsed <= RECONCILIATION_WINDOW_MS) {
    return { exactTimestamp, timeZone, relativeCountdown: "Checking Apple…", boundaryVerb: "Renews", reconciliationState: "checking", remainingMs: 0 };
  }
  if (input.lifecycleState === "renewal_pending") {
    return { exactTimestamp, timeZone, relativeCountdown: "Apple update delayed", boundaryVerb: "Renews", reconciliationState: "provider_delayed", remainingMs: 0 };
  }
  return { exactTimestamp, timeZone, relativeCountdown: "Access ended", boundaryVerb: "Access ended", reconciliationState: "expired", remainingMs: 0 };
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatExactTimestamp(value: Date, locale: string | undefined, timeZone: string): string {
  const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone }).format(value);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone }).format(value);
  return `${date} at ${time}`;
}
