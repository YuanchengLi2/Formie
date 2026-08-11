import { AppState } from "react-native";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { supabase } from "@/lib/supabase";

import { getAccessStatus, reserveAnalysis, cancelAnalysisReservation, refreshProviderAccess, refreshProviderAccessUntilChanged } from "./api";
import { subscribeAccessMutations, type AccessMutation } from "./access-events";
import { unknownAccess, type AccessStatus, type AnalysisReservation } from "./types";

type AccessContextValue = {
  status: "loading" | "ready" | "error";
  access: AccessStatus;
  error: string | null;
  refresh: () => Promise<AccessStatus>;
  reconcile: () => Promise<AccessStatus>;
  reconcileUntilChanged: () => Promise<AccessStatus>;
  realtimeStatus: "disconnected" | "connecting" | "connected";
  registerBillingSurface: () => () => void;
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

export function accessBoundaryRefreshDelays(access: Pick<AccessStatus, "quotaResetsAt" | "paidThrough">, now = Date.now()): number[] {
  return [...new Set([access.quotaResetsAt, access.paidThrough]
    .filter((value): value is string => Boolean(value))
    .filter((value) => Number.isFinite(new Date(value).getTime()) && new Date(value).getTime() > now)
    .map((value) => accessExpiryRefreshDelay(value, now)))]
    .sort((left, right) => left - right);
}

export function renewalReconciliationDelays(): number[] {
  return [2_000, 5_000, 10_000, 15_000, 30_000, 30_000];
}

export function billingFallbackRefreshInterval(access: Pick<AccessStatus, "status" | "lifecycleState" | "sandbox">, visible: boolean, appActive: boolean): number | null {
  if (!visible || !appActive) return null;
  if (access.sandbox || access.lifecycleState === "renewal_pending") return 5_000;
  return access.status === "active" ? 30_000 : 30_000;
}

export function mergeAccessMutation(access: AccessStatus, mutation: AccessMutation): AccessStatus {
  if (access.status !== "active" || mutation.remaining === null) return access;
  const quotaUsed = access.quotaLimit === null ? access.quotaUsed : Math.max(0, access.quotaLimit - mutation.remaining);
  return { ...access, remaining: mutation.remaining, quotaUsed, canAnalyze: mutation.remaining > 0, periodEndsAt: mutation.periodEndsAt ?? access.periodEndsAt, quotaResetsAt: mutation.periodEndsAt ?? access.quotaResetsAt, refreshedAt: new Date().toISOString() };
}

export function shouldCommitAccessRefresh(requestedUserId: string | null, currentUserId: string | null): boolean {
  return requestedUserId !== null && requestedUserId === currentUserId;
}

export function preserveConfirmedAccessDuringRenewal(current: AccessStatus, next: AccessStatus): AccessStatus {
  return current.status === "active" && next.lifecycleState === "renewal_pending" ? current : next;
}

export function shouldReconcileProviderOnResume(access: Pick<AccessStatus, "sandbox" | "store">): boolean {
  return !(access.sandbox && access.store === "test_store");
}

export function AccessProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [access, setAccess] = useState<AccessStatus>(unknownAccess);
  const [accessOwnerId, setAccessOwnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renewalPending, setRenewalPending] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [billingSurfaceCount, setBillingSurfaceCount] = useState(0);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const refreshDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserId = auth.phase === "authenticated" ? auth.user?.id ?? null : null;
  const identityRef = useRef<string | null>(currentUserId);
  const accessRef = useRef(access);
  const accessOwnerRef = useRef<string | null>(accessOwnerId);
  identityRef.current = currentUserId;
  accessRef.current = access;
  accessOwnerRef.current = accessOwnerId;

  const refresh = useCallback(async () => {
    const requestedUserId = currentUserId;
    if (!requestedUserId) {
      setRenewalPending(false);
      setAccess(unknownAccess);
      setAccessOwnerId(null);
      setStatus("ready");
      return unknownAccess;
    }
    setStatus((current) => current === "ready" ? "ready" : "loading");
    try {
      const next = await getAccessStatus();
      if (!shouldCommitAccessRefresh(requestedUserId, identityRef.current)) return next;
      setRenewalPending(next.lifecycleState === "renewal_pending");
      const confirmedAccess = accessOwnerRef.current === requestedUserId ? accessRef.current : unknownAccess;
      setAccess(preserveConfirmedAccessDuringRenewal(confirmedAccess, next));
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

  const reconcileProvider = useCallback(async (providerRefresh: (token: string) => Promise<AccessStatus> = refreshProviderAccess) => {
    const requestedUserId = currentUserId;
    const accessToken = auth.session?.access_token ?? null;
    if (!requestedUserId || !accessToken) return unknownAccess;
    try {
      const next = await providerRefresh(accessToken);
      if (!shouldCommitAccessRefresh(requestedUserId, identityRef.current)) return next;
      setRenewalPending(next.lifecycleState === "renewal_pending");
      const confirmedAccess = accessOwnerRef.current === requestedUserId ? accessRef.current : unknownAccess;
      setAccess(preserveConfirmedAccessDuringRenewal(confirmedAccess, next));
      setAccessOwnerId(requestedUserId);
      setStatus("ready");
      setError(null);
      return next;
    } catch (failure) {
      if (shouldCommitAccessRefresh(requestedUserId, identityRef.current)) {
        setError(failure instanceof Error ? failure.message : "Subscription status could not be refreshed.");
      }
      throw failure;
    }
  }, [auth.session?.access_token, currentUserId]);

  const reconcileProviderUntilChanged = useCallback(async () => {
    const baseline = access;
    return reconcileProvider((accessToken) => refreshProviderAccessUntilChanged(accessToken, baseline));
  }, [access, reconcileProvider]);

  const registerBillingSurface = useCallback(() => {
    let registered = true;
    setBillingSurfaceCount((count) => count + 1);
    return () => {
      if (!registered) return;
      registered = false;
      setBillingSurfaceCount((count) => Math.max(0, count - 1));
    };
  }, []);

  const refreshOnResume = useCallback(async () => {
    if (!shouldReconcileProviderOnResume(access)) return refresh();
    try {
      return await reconcileProviderUntilChanged();
    } catch {
      return refresh();
    }
  }, [access, reconcileProviderUntilChanged, refresh]);
  const refreshOnResumeRef = useRef(refreshOnResume);
  refreshOnResumeRef.current = refreshOnResume;

  useEffect(() => {
    if (auth.phase !== "authenticated") {
      setRenewalPending(false);
      setAccess(unknownAccess);
      setAccessOwnerId(null);
      setStatus("ready");
      return;
    }
    setRenewalPending(false);
    setAccess(unknownAccess);
    setAccessOwnerId(null);
    setStatus("loading");
    void refresh().catch(() => undefined);
    const listener = AppState.addEventListener("change", (next) => {
      setAppActive(next === "active");
      if (next === "active") void refreshOnResumeRef.current().catch(() => undefined);
    });
    const timer = setInterval(() => void refreshOnResumeRef.current().catch(() => undefined), 15 * 60 * 1000);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "subscription_test_scenarios", filter: `user_id=eq.${currentUserId}` }, scheduleRefresh)
      .subscribe((nextStatus) => {
        if (nextStatus === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          scheduleRefresh();
        } else if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT" || nextStatus === "CLOSED") {
          setRealtimeStatus("disconnected");
        } else {
          setRealtimeStatus("connecting");
        }
      });
    return () => {
      setRealtimeStatus("disconnected");
      if (refreshDebounce.current) clearTimeout(refreshDebounce.current);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, refresh]);

  useEffect(() => {
    const interval = billingFallbackRefreshInterval(access, billingSurfaceCount > 0, appActive);
    if (auth.phase !== "authenticated" || interval === null) return;
    const refreshBilling = shouldReconcileProviderOnResume(access) ? reconcileProvider : refresh;
    const timer = setInterval(() => void refreshBilling().catch(() => undefined), interval);
    return () => clearInterval(timer);
  }, [access, appActive, auth.phase, billingSurfaceCount, reconcileProvider, refresh]);

  useEffect(() => {
    if (auth.phase !== "authenticated") return;
    const refreshAtBoundary = shouldReconcileProviderOnResume(access) ? reconcileProviderUntilChanged : refresh;
    const timers = accessBoundaryRefreshDelays(access).map((delay) => setTimeout(() => void refreshAtBoundary().catch(() => undefined), delay));
    return () => timers.forEach(clearTimeout);
  }, [access, auth.phase, reconcileProviderUntilChanged, refresh]);

  useEffect(() => {
    if (auth.phase !== "authenticated" || !renewalPending) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let index = 0;
    const poll = () => {
      const delays = renewalReconciliationDelays();
      const delay = delays[index] ?? delays[delays.length - 1] ?? 30_000;
      timer = setTimeout(() => {
        void reconcileProvider().then((next) => {
          if (cancelled || next.lifecycleState !== "renewal_pending") return;
          index += 1;
          if (index < delays.length) poll();
        }).catch(() => {
          if (!cancelled) {
            index += 1;
            if (index < delays.length) poll();
          }
        });
      }, delay);
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [auth.phase, reconcileProvider, renewalPending]);

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
  const value = useMemo<AccessContextValue>(() => ({ status: visibleStatus, access: visibleAccess, error, refresh, reconcile: reconcileProvider, reconcileUntilChanged: reconcileProviderUntilChanged, realtimeStatus, registerBillingSurface, reserve, cancelReservation }), [cancelReservation, error, realtimeStatus, reconcileProvider, reconcileProviderUntilChanged, refresh, registerBillingSurface, reserve, visibleAccess, visibleStatus]);
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

export function useBillingSurfaceRefresh(): void {
  const { registerBillingSurface } = useAccess();
  useEffect(() => registerBillingSurface(), [registerBillingSurface]);
}
