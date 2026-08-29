import { AppState, Platform } from "react-native";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import Constants from "expo-constants";
import { useAuth } from "@/features/auth/auth-provider";
import { supabase } from "@/lib/supabase";
import { AnalyticsOutbox, fileAnalyticsOutboxStorage } from "./analytics-outbox";
import { AnalyticsSessionManager, randomAnalyticsUuid } from "./analytics-session";
import { registerAnalyticsAppSession, registerProductAnalyticsEnqueuer, type AnalyticsEventInput, type ProductAnalyticsEvent } from "./product-analytics";

type AnalyticsContextValue = { anonymousId: string | null; appSessionId: string | null; track: (eventName: ProductAnalyticsEvent, properties?: Record<string, unknown>, context?: Partial<Pick<AnalyticsEventInput, "captureFlowId" | "analysisSessionId">>) => void };
const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);
const retryDelays = [1_000, 2_000, 5_000, 15_000, 60_000];

export function AnalyticsProvider({ children }: PropsWithChildren) {
  const auth = useAuth(); const manager = useRef(new AnalyticsSessionManager()).current; const retryIndex = useRef(0); const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [identity, setIdentity] = useState<{ anonymousId: string; appSessionId: string } | null>(null);
  const enabled = process.env.EXPO_PUBLIC_FORMIE_RUNTIME_SMOKE !== "analysis";
  const outbox = useRef(new AnalyticsOutbox(fileAnalyticsOutboxStorage, async (events) => {
    const { data, error } = await supabase.functions.invoke("record-product-analytics", { body: { events } });
    if (error || !data || !Array.isArray(data.acceptedEventIds)) throw error ?? new Error("Invalid analytics acknowledgement");
    return { acceptedEventIds: data.acceptedEventIds.filter((item: unknown): item is string => typeof item === "string") };
  })).current;
  const flush = useCallback(async () => {
    if (!enabled) return;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    const delivered = await outbox.flush();
    if (delivered) { retryIndex.current = 0; if (await outbox.count() > 0) retryTimer.current = setTimeout(() => void flush(), 0); }
    else { const delay = retryDelays[Math.min(retryIndex.current++, retryDelays.length - 1)]!; retryTimer.current = setTimeout(() => void flush(), delay); }
  }, [enabled, outbox]);
  const track = useCallback((eventName: ProductAnalyticsEvent, properties: Record<string, unknown> = {}, context?: Partial<Pick<AnalyticsEventInput, "captureFlowId" | "analysisSessionId">>) => {
    const current = manager.snapshot(); if (!enabled || !current.anonymousId || !current.appSessionId) return;
    void outbox.enqueue({ clientEventId: randomAnalyticsUuid(), eventName, occurredAt: new Date().toISOString(), anonymousId: current.anonymousId, appSessionId: current.appSessionId, ...context, properties: properties as AnalyticsEventInput["properties"] }, false).then(flush);
  }, [enabled, flush, manager, outbox]);

  useEffect(() => { registerProductAnalyticsEnqueuer(track); return () => registerProductAnalyticsEnqueuer(null); }, [track]);
  useEffect(() => { registerAnalyticsAppSession(identity?.appSessionId ?? null); return () => registerAnalyticsAppSession(null); }, [identity?.appSessionId]);
  useEffect(() => {
    if (!enabled || auth.phase === "initializing") return;
    void manager.initialize(auth.user?.id ?? null).then((next) => { setIdentity(next); track("app_session_started", { platform: Platform.OS, appVersion: Constants.expoConfig?.version ?? "unknown", buildNumber: String(Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? "unknown") }); void flush(); });
  }, [auth.phase, auth.user?.id, enabled, flush, manager, track]);
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") { const previous = manager.snapshot().appSessionId; const appSessionId = manager.activate(); setIdentity({ ...manager.snapshot(), appSessionId }); if (appSessionId !== previous) track("app_session_started", { platform: Platform.OS }); void flush(); } else if (state === "background") manager.background(); });
    return () => subscription.remove();
  }, [enabled, flush, manager, track]);
  useEffect(() => () => { if (retryTimer.current) clearTimeout(retryTimer.current); }, []);
  const value = useMemo(() => ({ anonymousId: identity?.anonymousId ?? null, appSessionId: identity?.appSessionId ?? null, track }), [identity, track]);
  return <AnalyticsContext value={value}>{children}</AnalyticsContext>;
}

export function useAnalytics(): AnalyticsContextValue { const value = use(AnalyticsContext); if (!value) throw new Error("useAnalytics must be used within AnalyticsProvider"); return value; }
