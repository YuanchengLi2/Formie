import type { AccessStatus } from "./types";
import { formatQuotaMessage } from "./quota-message";

type AccessResolver = {
  status: "loading" | "ready" | "error";
  access: AccessStatus;
  refresh: () => Promise<AccessStatus>;
};

export async function ensureAnalysisAccess(resolver: AccessResolver | null): Promise<AccessStatus | null> {
  if (!resolver) return null;
  const access = resolver.status === "ready" && resolver.access.status !== "unknown"
    ? resolver.access
    : await resolver.refresh();
  if (access.canAnalyze) return access;
  if (access.status === "expired") {
    throw new Error("An active Formie subscription is required for another analysis. Your saved result remains available.");
  }
  if (access.lifecycleState === "active_cancelled") {
    throw new Error(`${formatQuotaMessage({ lifecycleState: access.lifecycleState, limit: access.quotaLimit, resetsAt: access.quotaResetsAt, paidThrough: access.paidThrough })} Your saved result remains available.`);
  }
  throw new Error("No analyses remain in the current billing period. Your saved result remains available.");
}
