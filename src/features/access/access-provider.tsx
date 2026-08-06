import { AppState } from "react-native";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { supabase } from "@/lib/supabase";

import { getAccessStatus, reserveAnalysis, cancelAnalysisReservation } from "./api";
import { subscribeAccessMutations, type AccessMutation } from "./access-events";
import { unknownAccess, type AccessStatus, type AnalysisReservation } from "./types";

type AccessContextValue = {
  status: "loading" | "ready" | "error";
  access: AccessStatus;
  error: string | null;
  refresh: () => Promise<AccessStatus>;
  reserve: (kind: "analysis" | "reanalysis", clientRequestId: string, sessionId?: string) => Promise<AnalysisReservation>;
  cancelReservation: (reservationId: string) => Promise<void>;
};

const AccessContext = createContext<AccessContextValue | null>(null);
const MAX_TIMER_DELAY_MS = 2_147_000_000;

export function accessExpiryRefreshDelay(periodEndsAt: string, now = Date.now()): number {
  const expiresAt = new Date(periodEndsAt).getTime();
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.min(MAX_TIMER_DELAY_MS, Math.max(0, expiresAt - now + 1_000));
}

export function mergeAccessMutation(access: AccessStatus, mutation: AccessMutation): AccessStatus {
  if (access.status !== "active" || mutation.remaining === null) return access;
  const quotaUsed = access.quotaLimit === null ? access.quotaUsed : Math.max(0, access.quotaLimit - mutation.remaining);
  return { ...access, remaining: mutation.remaining, quotaUsed, canAnalyze: mutation.remaining > 0, periodEndsAt: mutation.periodEndsAt ?? access.periodEndsAt, refreshedAt: new Date().toISOString() };
}

export function shouldCommitAccessRefresh(requestedUserId: string | null, currentUserId: string | null): boolean {
  return requestedUserId !== null && requestedUserId === currentUserId;
}

export function AccessProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [access, setAccess] = useState<AccessStatus>(unknownAccess);
  const [accessOwnerId, setAccessOwnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserId = auth.phase === "authenticated" ? auth.user?.id ?? null : null;
  const identityRef = useRef<string | null>(currentUserId);
  identityRef.current = currentUserId;

  const refresh = useCallback(async () => {
    const requestedUserId = currentUserId;
    if (!requestedUserId) {
      setAccess(unknownAccess);
      setAccessOwnerId(null);
      setStatus("ready");
      return unknownAccess;
    }
    setStatus((current) => current === "ready" ? "ready" : "loading");
    try {
      const next = await getAccessStatus();
      if (!shouldCommitAccessRefresh(requestedUserId, identityRef.current)) return next;
      setAccess(next);
      setAccessOwnerId(requestedUserId);
      setStatus("ready");
      setError(null);
      return next;
    } catch (failure) {
      if (!shouldCommitAccessRefresh(requestedUserId, identityRef.current)) return unknownAccess;
      setStatus("error");
      setError(failure instanceof Error ? failure.message : "Access status could not be refreshed.");
      throw failure;
    }
  }, [currentUserId]);

  useEffect(() => {
    if (auth.phase !== "authenticated") {
      setAccess(unknownAccess);
      setAccessOwnerId(null);
      setStatus("ready");
      return;
    }
    setAccess(unknownAccess);
    setAccessOwnerId(null);
    setStatus("loading");
    void refresh().catch(() => undefined);
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") void refresh().catch(() => undefined);
    });
    const timer = setInterval(() => void refresh().catch(() => undefined), 15 * 60 * 1000);
    return () => {
      listener.remove();
      clearInterval(timer);
    };
  }, [auth.phase, currentUserId, refresh]);

  useEffect(() => subscribeAccessMutations((mutation) => {
    if (!currentUserId) return;
    setAccess((current) => mergeAccessMutation(current, mutation));
    if (refreshDebounce.current) clearTimeout(refreshDebounce.current);
    refreshDebounce.current = setTimeout(() => void refresh().catch(() => undefined), 80);
  }), [currentUserId, refresh]);

  useEffect(() => {
    if (!currentUserId) return;
    const scheduleRefresh = () => {
      if (refreshDebounce.current) clearTimeout(refreshDebounce.current);
      refreshDebounce.current = setTimeout(() => void refresh().catch(() => undefined), 80);
    };
    const channel = supabase.channel(`access:${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_access_entitlements", filter: `user_id=eq.${currentUserId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "analysis_credit_reservations", filter: `user_id=eq.${currentUserId}` }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshDebounce.current) clearTimeout(refreshDebounce.current);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, refresh]);

  useEffect(() => {
    if (auth.phase !== "authenticated" || access.status !== "active" || !access.periodEndsAt) return;
    const timer = setTimeout(() => void refresh().catch(() => undefined), accessExpiryRefreshDelay(access.periodEndsAt));
    return () => clearTimeout(timer);
  }, [access.periodEndsAt, access.status, auth.phase, refresh]);

  const reserve = useCallback(async (kind: "analysis" | "reanalysis", clientRequestId: string, sessionId?: string) => {
    const reservation = await reserveAnalysis(kind, clientRequestId, sessionId);
    await refresh().catch(() => undefined);
    return reservation;
  }, [refresh]);

  const cancelReservation = useCallback(async (reservationId: string) => {
    await cancelAnalysisReservation(reservationId);
    await refresh().catch(() => undefined);
  }, [refresh]);

  const visibleAccess = accessOwnerId === currentUserId ? access : unknownAccess;
  const visibleStatus = currentUserId && accessOwnerId !== currentUserId ? "loading" : status;
  const value = useMemo<AccessContextValue>(() => ({ status: visibleStatus, access: visibleAccess, error, refresh, reserve, cancelReservation }), [cancelReservation, error, refresh, reserve, visibleAccess, visibleStatus]);
  return <AccessContext value={value}>{children}</AccessContext>;
}

export function useAccess(): AccessContextValue {
  const value = useOptionalAccess();
  if (!value) throw new Error("useAccess must be used inside AccessProvider");
  return value;
}

export function useOptionalAccess(): AccessContextValue | null {
  return use(AccessContext);
}
