import type { AccessStatus } from "./types";

export type AnalysisEntry = "record" | "quota_exhausted" | "purchase" | "unavailable";

export function canOpenCompletedAccount({
  authenticated,
  profileComplete,
  onboardingStatus,
  accessStatus,
}: {
  authenticated: boolean;
  profileComplete: boolean;
  onboardingStatus: string;
  accessStatus: AccessStatus["status"];
}): boolean {
  if (!authenticated || !profileComplete) return false;
  if (accessStatus === "active") return true;
  return accessStatus === "expired" && onboardingStatus !== "premium_required";
}

export function resolveAnalysisEntry(
  providerStatus: "loading" | "ready" | "error",
  access: AccessStatus,
): AnalysisEntry {
  if (providerStatus !== "ready" || access.status === "unknown") return "unavailable";
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
