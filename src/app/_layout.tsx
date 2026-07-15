import { DarkTheme, ThemeProvider } from "expo-router/react-navigation";
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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="recording-tips" options={{ headerShown: true, title: "Recording Tips", headerBackButtonDisplayMode: "minimal" }} />
          <Stack.Screen name="camera" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen
            name="no-phone-space"
            options={{
              headerShown: true,
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
