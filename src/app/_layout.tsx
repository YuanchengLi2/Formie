import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { type Href, useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@/components/app-providers";
import { SubscriptionAccessGate } from "@/components/subscription-access-gate";
import { AccessProvider, useAccess } from "@/features/access/access-provider";
import { canOpenCompletedAccount } from "@/features/access/account-access";
import { consumeAuthReturnTarget } from "@/features/auth/auth-return-target";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { BillingProvider } from "@/features/billing/billing-provider";
import { OnboardingProvider, useOnboarding } from "@/features/onboarding/onboarding-store";
import { ProfileProvider, useProfile } from "@/features/profile/profile-provider";
import { colors } from "@/theme/colors";

const formTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, primary: colors.gold, background: colors.background, card: colors.background, text: colors.text, border: colors.border, notification: colors.gold } };

function RootNavigator() {
  const auth = useAuth();
  const profile = useProfile();
  const access = useAccess();
  const onboarding = useOnboarding();
  const authenticated = auth.phase === "authenticated";
  const profileComplete = profile.profile?.onboardingCompleted === true;
  const appUnlocked = canOpenCompletedAccount({ authenticated, profileComplete, onboardingStatus: onboarding.status, accessStatus: access.access.status });
  const onboardingAllowed = auth.phase === "signed_out" || (authenticated && !profileComplete);
  const router = useRouter();
  const handledAuthenticatedUser = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated || !auth.user || handledAuthenticatedUser.current === auth.user.id) return;
    handledAuthenticatedUser.current = auth.user.id;
    void consumeAuthReturnTarget().then((target) => {
      if (target) router.replace(target as Href);
    });
  }, [auth.user, authenticated, router]);

  return <ThemeProvider value={formTheme}>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.gold, headerShadowVisible: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={onboardingAllowed}><Stack.Screen name="onboarding" /></Stack.Protected>
      <Stack.Protected guard={auth.phase === "signed_out"}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/email" />
        <Stack.Screen name="(auth)/email-code" />
      </Stack.Protected>
      <Stack.Screen name="subscription" />
      <Stack.Protected guard={appUnlocked}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account/send-feedback" options={{ headerShown: true, title: "Send Feedback", headerBackButtonDisplayMode: "minimal" }} />
        <Stack.Screen name="account/manage-subscription" options={{ headerShown: false }} />
        <Stack.Screen name="exercise-selection" options={{ headerShown: true, title: "Choose Exercise", headerBackButtonDisplayMode: "minimal" }} />
        <Stack.Screen name="exercise-guide" options={{ headerShown: true, title: "Exercise Guide", headerBackButtonDisplayMode: "minimal" }} />
        <Stack.Screen name="recording-tips" options={{ headerShown: true, title: "Recording Tips", headerBackButtonDisplayMode: "minimal" }} />
        <Stack.Screen name="camera" options={{ gestureEnabled: false }} />
        <Stack.Screen name="analysis/review" options={{ gestureEnabled: false }} />
        <Stack.Screen name="analysis/set-details" options={{ gestureEnabled: false }} />
        <Stack.Screen name="analysis/upload" options={{ gestureEnabled: false }} />
        <Stack.Screen name="analysis/[session-id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="results/[session-id]" />
        <Stack.Screen name="no-phone-space" options={{ presentation: "formSheet", sheetGrabberVisible: true, sheetAllowedDetents: [0.72, 1] }} />
      </Stack.Protected>
    </Stack>
  </ThemeProvider>;
}

export default function RootLayout() {
  return <AppProviders><AuthProvider><OnboardingProvider><AccessProvider><BillingProvider><ProfileProvider><SubscriptionAccessGate><RootNavigator /></SubscriptionAccessGate></ProfileProvider></BillingProvider></AccessProvider></OnboardingProvider></AuthProvider></AppProviders>;
}
