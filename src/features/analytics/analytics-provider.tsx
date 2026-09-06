import { AppState } from "react-native";
import { useEffect, type PropsWithChildren } from "react";

import { useAuth } from "@/features/auth/auth-provider";
import { analyticsQueue } from "./analytics-queue";

export function AnalyticsProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const accountId = auth.user?.id ?? null;
  useEffect(() => { void analyticsQueue.setAccount(accountId).then(() => analyticsQueue.flush()).catch(() => undefined); }, [accountId]);
  useEffect(() => {
    void analyticsQueue.beginForegroundSession().then(() => analyticsQueue.flush()).catch(() => undefined);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void analyticsQueue.beginForegroundSession().then(() => analyticsQueue.flush()).catch(() => undefined); });
    return () => subscription.remove();
  }, []);
  return children;
}
