import type { AccessStatus } from "./types";

export type AnalysisEntry = "record" | "analysis_pending" | "quota_exhausted" | "purchase" | "renewal_pending" | "unavailable";
export type AccountEligibility = "eligible" | "age_restricted";

export function resolveAccountEligibility(ageYears: number | null | undefined): AccountEligibility {
  return Number.isInteger(ageYears) && Number(ageYears) >= 18 ? "eligible" : "age_restricted";
}

export function formatAnalysisEntryLabel(entry: AnalysisEntry, lifecycleState: AccessStatus["lifecycleState"], remaining: number | null): string {
  if (entry === "purchase") return "Purchase";
  if (entry === "analysis_pending") return "View analysis";
  if (entry === "renewal_pending") return "Checking";
  return "Record";
}

export function analysisEntryHref(entry: AnalysisEntry, pendingAnalysisSessionId: string | null): string | null {
  if (entry === "record") return "/exercise-selection";
  if (entry === "purchase") return "/subscription?returnTo=%2Fexercise-selection";
  if (entry === "analysis_pending" && pendingAnalysisSessionId) return `/analysis/${pendingAnalysisSessionId}`;
  return null;
}

export function canOpenCompletedAccount({
  authenticated,
  profileComplete,
  accessStatus,
}: {
  authenticated: boolean;
  profileComplete: boolean;
  onboardingStatus: string;
  accessStatus: AccessStatus["status"];
}): boolean {
  if (!authenticated || !profileComplete) return false;
  return accessStatus === "active" || accessStatus === "expired";
}

export function canOpenSubscriptionScreen({
  authenticated,
  profileComplete,
}: {
  authenticated: boolean;
  profileComplete: boolean;
}): boolean {
  return authenticated && profileComplete;
}

export function resolveAnalysisEntry(
  providerStatus: "loading" | "ready" | "error",
  access: AccessStatus,
): AnalysisEntry {
  if (providerStatus !== "ready") return "unavailable";
  if (access.lifecycleState === "renewal_pending") return "renewal_pending";
  if (access.pendingAnalysisSessionId) return "analysis_pending";
  if (access.status === "unknown") return "unavailable";
  if (access.status === "expired") return "purchase";
  if (access.canAnalyze) return "record";
  return "quota_exhausted";
}

export function formatAnalysisBalance(access: AccessStatus): string {
  if (access.status === "expired") return "Subscription required";
  if (access.status === "unknown") return "Checking analyses";
  if (access.remaining === null) return "Analyses available";
  return `${access.remaining} ${access.remaining === 1 ? "analysis" : "analyses"} left`;
}

export function formatAnalysisFraction(remaining: number | null, limit: number | null): string {
  const safeLimit = Number.isInteger(limit) && Number(limit) > 0 ? Number(limit) : 10;
  if (remaining === null || !Number.isFinite(remaining)) return `—/${safeLimit}`;
  return `${Math.max(0, Math.min(safeLimit, Math.floor(remaining)))}/${safeLimit}`;
}

export function formatSubscriptionDate(value: string | null, includeYear = true): string {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(parsed);
}

export function formatBillingTimestamp(value: string | null, locale?: string, timeZone?: string): string {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Not available";
  const zone = timeZone ? { timeZone } : {};
  const date = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", ...zone }).format(parsed);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZoneName: "short", ...zone }).format(parsed);
  return `${date} at ${time}`;
}

export function formatSubscriptionStateLabel(access: Pick<AccessStatus, "lifecycleState" | "paidThrough">, locale?: string, timeZone?: string): string {
  const boundary = access.paidThrough ? formatBillingTimestamp(access.paidThrough, locale, timeZone) : "billing date";
  if (access.lifecycleState === "active_cancelled") return `Canceled · Automatic renewal off · Access ends ${boundary}`;
  if (access.lifecycleState === "renewal_pending") return "Checking renewal · Automatic renewal pending";
  if (access.lifecycleState === "expired") return `Expired · Automatic renewal off · Access ended ${access.paidThrough ? boundary : "on the last billing date"}`;
  if (access.lifecycleState === "not_subscribed") return "No active subscription · Automatic renewal off";
  if (access.lifecycleState === "unknown") return "Checking subscription";
  return `Active · Automatic renewal on · Next billing ${boundary}`;
}
