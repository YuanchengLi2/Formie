import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@/components/app-providers";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { ProfileProvider } from "@/features/profile/profile-provider";
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

function RootNavigator() {
  const auth = useAuth();
  const { phase } = auth;
  const signedOut = phase === "signed_out";
  const verificationPending = phase === "verification_pending";
  const passwordSetupRequired = phase === "password_recovery";
  const appUnlocked = phase === "authenticated";
  return (
    <ThemeProvider value={formTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.gold, headerShadowVisible: false, headerTitleStyle: { color: colors.gold, fontSize: 12, fontWeight: "600" } }}>
          <Stack.Screen name="index" />
          <Stack.Protected guard={signedOut}>
            <Stack.Screen name="(auth)/login" />
            <Stack.Screen name="(auth)/forgot-password" />
          </Stack.Protected>
          <Stack.Protected guard={signedOut}>
            <Stack.Screen name="(auth)/sign-up" />
          </Stack.Protected>
          <Stack.Protected guard={verificationPending}>
            <Stack.Screen name="(auth)/verify-email" />
          </Stack.Protected>
          <Stack.Protected guard={passwordSetupRequired}>
            <Stack.Screen name="(auth)/reset-password" />
          </Stack.Protected>
          <Stack.Protected guard={phase === "initializing"}>
            <Stack.Screen name="(auth)/auth/callback" />
          </Stack.Protected>
          <Stack.Protected guard={appUnlocked}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="account/change-email" options={{ headerShown: true, title: "Change Email", headerBackButtonDisplayMode: "minimal" }} />
            <Stack.Screen name="account/change-password" options={{ headerShown: true, title: "Change Password", headerBackButtonDisplayMode: "minimal" }} />
            <Stack.Screen name="exercise-selection" options={{ headerShown: true, title: "Choose Exercise", headerBackButtonDisplayMode: "minimal" }} />
            <Stack.Screen name="exercise-guide" options={{ headerShown: true, title: "Exercise Guide", headerBackButtonDisplayMode: "minimal" }} />
            <Stack.Screen name="recording-tips" options={{ headerShown: true, title: "Recording Tips", headerBackButtonDisplayMode: "minimal" }} />
            <Stack.Screen name="camera" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="analysis/review" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="analysis/set-details" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="analysis/upload" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="analysis/[session-id]" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="results/[session-id]" options={{ headerShown: false }} />
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
          </Stack.Protected>
        </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
        <AuthProvider>
        <ProfileProvider>
          <RootNavigator />
        </ProfileProvider>
      </AuthProvider>
    </AppProviders>
  );
}
