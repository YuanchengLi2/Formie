import { useEffect, type PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { queryClient } from "@/lib/query-client";
import { bindAuthRefreshLifecycle } from "@/lib/auth-refresh-lifecycle";
import { supabase } from "@/lib/supabase";

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => bindAuthRefreshLifecycle({
    platform: Platform.OS,
    currentState: AppState.currentState,
    start: () => supabase.auth.startAutoRefresh(),
    stop: () => supabase.auth.stopAutoRefresh(),
    addListener: (listener) => AppState.addEventListener("change", listener),
  }), []);

  return <GestureHandlerRootView style={{ flex: 1 }}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></GestureHandlerRootView>;
}
