import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { queryClient } from "@/lib/query-client";

export function AppProviders({ children }: PropsWithChildren) {
  return <GestureHandlerRootView style={{ flex: 1 }}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></GestureHandlerRootView>;
}
