import { DarkTheme, ThemeProvider, type Href, useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@/components/app-providers";
import { AnalysisRuntimeSmoke } from "@/components/analysis-runtime-smoke";
import { SubscriptionAccessGate } from "@/components/subscription-access-gate";
import { AccessProvider, useAccess } from "@/features/access/access-provider";
import { canOpenCompletedAccount, canOpenOnboarding } from "@/features/access/account-access";
import { consumeAuthReturnTarget } from "@/features/auth/auth-return-target";
import { AuthProvider, useAuth } from "@/features/auth/auth-provider";
import { BillingProvider } from "@/features/billing/billing-provider";
import { AnalyticsProvider } from "@/features/analytics/analytics-provider";
import { getAnalysisRecoveryStore, recoveryCaptureEvent, recoveryDestination } from "@/features/capture/analysis-recovery-store";
import { useCaptureStore } from "@/features/capture/capture-store";
import { OnboardingProvider, useOnboarding } from "@/features/onboarding/onboarding-store";
import { ProfileProvider, useProfile } from "@/features/profile/profile-provider";
import { ReferralProvider } from "@/features/referrals/referral-provider";
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
  const onboardingAllowed = canOpenOnboarding({ phase: auth.phase, profileStatus: profile.status, profileComplete });
  const router = useRouter();
  const handledAuthenticatedUser = useRef<string | null>(null);
  const recoveredAnalysisUser = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated || !auth.user || handledAuthenticatedUser.current === auth.user.id) return;
    handledAuthenticatedUser.current = auth.user.id;
    void consumeAuthReturnTarget().then((target) => {
      if (target) router.replace(target as Href);
    });
  }, [auth.user, authenticated, router]);

  useEffect(() => {
    if (!appUnlocked || !auth.user || recoveredAnalysisUser.current === auth.user.id) return;
    recoveredAnalysisUser.current = auth.user.id;
    let active = true;
    void getAnalysisRecoveryStore().load().then(async (job) => {
      if (!active) return;
      if (job && job.userId !== auth.user?.id) {
        await getAnalysisRecoveryStore().clear();
        return;
      }
      const event = recoveryCaptureEvent(job, auth.user!.id);
      const destination = recoveryDestination(job, auth.user!.id);
      if (!event || !destination || !active) return;
      useCaptureStore.getState().dispatch(event);
      router.replace(destination as Href);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [appUnlocked, auth.user, router]);

  return <ThemeProvider value={formTheme}>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.gold, headerShadowVisible: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={onboardingAllowed}><Stack.Screen name="onboarding" /></Stack.Protected>
      <Stack.Protected guard={auth.phase === "signed_out"}>
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/password" />
        <Stack.Screen name="(auth)/email" />
        <Stack.Screen name="(auth)/email-code" />
      </Stack.Protected>
      <Stack.Screen name="subscription" />
      <Stack.Protected guard={appUnlocked}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account/send-feedback" options={{ headerShown: true, title: "Send Feedback", headerBackButtonDisplayMode: "minimal" }} />
        <Stack.Screen name="account/manage-subscription" options={{ headerShown: false }} />
        <Stack.Screen name="exercise-selection" options={{ headerShown: true, title: "Choose Exercise", headerBackButtonDisplayMode: "minimal" }} />
        <Stack.Screen name="exercise-guide" options={{ headerShown: false }} />
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
  if (process.env.EXPO_PUBLIC_FORMIE_RUNTIME_SMOKE === "analysis") {
    return <AppProviders><AnalysisRuntimeSmoke /></AppProviders>;
  }
  return <AppProviders><AuthProvider><AnalyticsProvider><ReferralProvider><OnboardingProvider><AccessProvider><BillingProvider><ProfileProvider><SubscriptionAccessGate><RootNavigator /></SubscriptionAccessGate></ProfileProvider></BillingProvider></AccessProvider></OnboardingProvider></ReferralProvider></AnalyticsProvider></AuthProvider></AppProviders>;
}
