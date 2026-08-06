import { supabase } from "@/lib/supabase";

import { unknownAccess, type AccessStatus, type AnalysisReservation } from "./types";

export function asAccess(value: unknown): AccessStatus {
  if (!value || typeof value !== "object") return { ...unknownAccess, refreshedAt: new Date().toISOString() };
  const row = (Array.isArray(value) ? value[0] : value) as Record<string, unknown>;
  const status = row.status === "active" || row.status === "expired" ? row.status : "unknown";
  const source = row.source === "revenuecat" ? "revenuecat" : "unknown";
  const remaining = typeof row.remaining === "number" ? row.remaining : null;
  return {
    status,
    canAnalyze: status === "active" && remaining !== null && remaining > 0,
    quotaUsed: typeof row.quota_used === "number" ? row.quota_used : null,
    quotaLimit: typeof row.quota_limit === "number" ? row.quota_limit : null,
    remaining,
    periodStartsAt: typeof row.period_starts_at === "string" ? row.period_starts_at : null,
    periodEndsAt: typeof row.period_ends_at === "string" ? row.period_ends_at : null,
    entitlementId: typeof row.entitlement_id === "string" ? row.entitlement_id : null,
    source,
    refreshedAt: new Date().toISOString(),
  };
}

export async function getAccessStatus(): Promise<AccessStatus> {
  const { data, error } = await supabase.rpc("get_my_access_status");
  if (error) throw error;
  return asAccess(data);
}

export async function reserveAnalysis(kind: "analysis" | "reanalysis", clientRequestId: string, sessionId?: string): Promise<AnalysisReservation> {
  const { data, error } = await supabase.rpc(kind === "analysis" ? "reserve_analysis_session_v2" : "reserve_reanalysis_v2", {
    p_client_request_id: clientRequestId,
    ...(sessionId ? { p_session_id: sessionId } : {}),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  if (!row || typeof row.reservation_id !== "string") throw new Error("Analysis access reservation was invalid.");
  return { reservationId: row.reservation_id, status: row.status === "already_reserved" ? "already_reserved" : "reserved", remaining: typeof row.remaining === "number" ? row.remaining : null, periodEndsAt: typeof row.period_ends_at === "string" ? row.period_ends_at : null };
}

export async function cancelAnalysisReservation(reservationId: string): Promise<void> {
  await cancelAnalysis({ reservationId });
}

export async function cancelAnalysis(input: { reservationId?: string; sessionId?: string }): Promise<void> {
  const { data, error } = await supabase.functions.invoke("cancel-analysis", { body: input });
  if (error) throw error;
  const access = data && typeof data === "object" ? (data as { access?: Record<string, unknown> }).access : null;
  const { publishAccessMutation } = await import("./access-events");
  publishAccessMutation({ remaining: typeof access?.remaining === "number" ? access.remaining : null, periodEndsAt: typeof access?.period_ends_at === "string" ? access.period_ends_at : null });
}

export async function reconcileAccess(): Promise<void> {
  const { error } = await supabase.functions.invoke("reconcile-entitlements");
  if (error) throw error;
}
