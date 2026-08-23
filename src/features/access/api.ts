import { supabase } from "@/lib/supabase";
import { publishAccessMutation } from "./access-events";

import { unknownAccess, type AccessStatus, type AnalysisReservation } from "./types";

export function asAccess(value: unknown): AccessStatus {
  if (!value || typeof value !== "object") return { ...unknownAccess, refreshedAt: new Date().toISOString() };
  const row = (Array.isArray(value) ? value[0] : value) as Record<string, unknown>;
  const status = row.status === "active" || row.status === "expired" ? row.status : "unknown";
  const source = row.source === "revenuecat" ? "revenuecat" : "unknown";
  const remaining = typeof row.remaining === "number" ? row.remaining : null;
  const rawLifecycle = row.lifecycle_state ?? row.lifecycleState;
  const lifecycleState = rawLifecycle === "active_renewing" || rawLifecycle === "active_cancelled" || rawLifecycle === "renewal_pending" || rawLifecycle === "expired" || rawLifecycle === "not_subscribed" ? rawLifecycle : "unknown";
  const quotaPeriodStartsAt = typeof row.quota_period_start === "string" ? row.quota_period_start : typeof row.quotaPeriodStartsAt === "string" ? row.quotaPeriodStartsAt : typeof row.period_starts_at === "string" ? row.period_starts_at : typeof row.periodStartsAt === "string" ? row.periodStartsAt : null;
  const quotaResetsAt = typeof row.quota_period_end === "string" ? row.quota_period_end : typeof row.quotaResetsAt === "string" ? row.quotaResetsAt : typeof row.period_ends_at === "string" ? row.period_ends_at : typeof row.periodEndsAt === "string" ? row.periodEndsAt : null;
  return {
    status,
    lifecycleState,
    canAnalyze: status === "active" && (row.can_analyze === true || row.canAnalyze === true),
    quotaUsed: typeof row.quota_used === "number" ? row.quota_used : typeof row.quotaUsed === "number" ? row.quotaUsed : null,
    quotaLimit: typeof row.quota_limit === "number" ? row.quota_limit : typeof row.quotaLimit === "number" ? row.quotaLimit : null,
    remaining,
    periodStartsAt: quotaPeriodStartsAt,
    periodEndsAt: quotaResetsAt,
    quotaPeriodStartsAt,
    quotaResetsAt,
    billingPeriodStartsAt: typeof row.billing_period_start === "string" ? row.billing_period_start : typeof row.billingPeriodStartsAt === "string" ? row.billingPeriodStartsAt : null,
    paidThrough: typeof row.billing_period_end === "string" ? row.billing_period_end : typeof row.paidThrough === "string" ? row.paidThrough : null,
    productIdentifier: typeof row.product_identifier === "string" ? row.product_identifier : typeof row.productIdentifier === "string" ? row.productIdentifier : null,
    planCode: row.plan_code === "annual" || row.planCode === "annual" ? "annual" : row.plan_code === "monthly" || row.planCode === "monthly" ? "monthly" : null,
    store: typeof row.store === "string" ? row.store : null,
    sandbox: row.sandbox === true,
    willRenew: row.will_renew === true || row.willRenew === true,
    pendingAnalysisSessionId: typeof row.pending_analysis_session_id === "string" ? row.pending_analysis_session_id : typeof row.pendingAnalysisSessionId === "string" ? row.pendingAnalysisSessionId : null,
    stateVersion: typeof row.state_version === "number" ? row.state_version : typeof row.stateVersion === "number" ? row.stateVersion : 0,
    entitlementId: typeof row.entitlement_id === "string" ? row.entitlement_id : typeof row.entitlementId === "string" ? row.entitlementId : null,
    source,
    refreshedAt: typeof row.refreshedAt === "string" ? row.refreshedAt : new Date().toISOString(),
  };
}

export async function getAccessStatus(): Promise<AccessStatus> {
  const { data, error } = await supabase.rpc("get_my_access_status");
  if (error) throw error;
  return asAccess(data);
}

export async function refreshProviderAccess(accessToken: string): Promise<AccessStatus> {
  const { data, error } = await supabase.functions.invoke("refresh-entitlement", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw error;
  const access = data && typeof data === "object" ? (data as { access?: unknown }).access : null;
  if (!access) throw new Error("Subscription refresh returned no access snapshot.");
  return asAccess(access);
}

export type AccessRefreshBaseline = Pick<AccessStatus, "status" | "lifecycleState" | "remaining" | "stateVersion" | "willRenew" | "paidThrough">;

export function accessSnapshotChanged(previous: AccessRefreshBaseline, next: AccessStatus): boolean {
  return previous.status !== next.status
    || previous.lifecycleState !== next.lifecycleState
    || previous.remaining !== next.remaining
    || previous.stateVersion !== next.stateVersion
    || previous.willRenew !== next.willRenew
    || previous.paidThrough !== next.paidThrough;
}

export async function refreshProviderAccessUntilChanged(
  accessToken: string,
  previous: AccessRefreshBaseline,
  refresh: (token: string) => Promise<AccessStatus> = refreshProviderAccess,
  delays = [0, 1_000, 3_000, 7_000],
  wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<AccessStatus> {
  let next = await refresh(accessToken);
  if (accessSnapshotChanged(previous, next)) return next;
  for (const delay of delays.slice(1)) {
    await wait(delay);
    next = await refresh(accessToken);
    if (accessSnapshotChanged(previous, next)) return next;
  }
  return next;
}

export async function reserveAnalysis(kind: "analysis" | "reanalysis", clientRequestId: string, sessionId?: string): Promise<AnalysisReservation> {
  const { data, error } = await supabase.rpc(kind === "analysis" ? "reserve_analysis_session_v2" : "reserve_reanalysis_v2", {
    p_client_request_id: clientRequestId,
    ...(sessionId ? { p_session_id: sessionId } : {}),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  if (!row || (typeof row.reservation_id !== "string" && row.status !== "analysis_pending")) throw new Error("Analysis access reservation was invalid.");
  return { reservationId: typeof row.reservation_id === "string" ? row.reservation_id : null, status: row.status === "analysis_pending" ? "analysis_pending" : row.status === "already_reserved" ? "already_reserved" : "reserved", remaining: typeof row.remaining === "number" ? row.remaining : null, periodEndsAt: typeof row.period_ends_at === "string" ? row.period_ends_at : null, blockingSessionId: typeof row.blocking_session_id === "string" ? row.blocking_session_id : null };
}

export async function cancelAnalysisReservation(reservationId: string): Promise<void> {
  await cancelAnalysis({ reservationId });
}

export async function cancelAnalysis(input: { reservationId?: string; sessionId?: string; reason?: "upload_failed" | "user_discarded" }): Promise<void> {
  const { data, error } = await supabase.functions.invoke("cancel-analysis", { body: input });
  if (error) throw error;
  const access = data && typeof data === "object" ? (data as { access?: Record<string, unknown> }).access : null;
  publishAccessMutation({ remaining: typeof access?.remaining === "number" ? access.remaining : null, periodEndsAt: typeof access?.period_ends_at === "string" ? access.period_ends_at : null });
}
