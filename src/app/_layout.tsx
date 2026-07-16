import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@/components/app-providers";
import { colors } from "@/theme/colors";

const formTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.gold,
  },
};

export default function RootLayout() {
  return (
    <AppProviders>
      <ThemeProvider value={formTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.gold, headerShadowVisible: false, headerTitleStyle: { color: colors.gold, fontSize: 12, fontWeight: "600" } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="recording-tips" options={{ headerShown: true, title: "Recording Tips", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="camera" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="analysis/[session-id]" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="results/[session-id]" options={{ headerShown: false }} />
          <Stack.Screen name="results/[session-id]/finding/[finding-id]" options={{ headerShown: true, title: "FORM", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen
            name="no-phone-space"
            options={{
              headerShown: false,
              title: "Quick Setup Ideas",
              headerBackButtonDisplayMode: "minimal",
              presentation: "formSheet",
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.72, 1],
            }}
          />
        </Stack>
      </ThemeProvider>
    </AppProviders>
  );
}
