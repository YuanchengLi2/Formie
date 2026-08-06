import { Redirect, type Href } from "expo-router";

import { useAccess } from "@/features/access/access-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { resolveLaunchRoute, type OnboardingLaunchState } from "@/features/auth/launch-route";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { useProfile } from "@/features/profile/profile-provider";
import { AuthLoadingScreen } from "@/screens/auth";

function launchState(status: ReturnType<typeof useOnboarding>["status"], currentStep: ReturnType<typeof useOnboarding>["currentStep"], explicitLogoutAt: string | null): OnboardingLaunchState {
  if (explicitLogoutAt) return "logged_out";
  if (status === "account_required") return "awaiting_account";
  if (status === "profile_sync_required") return "profile_sync_required";
  if (status === "premium_required") return "premium_required";
  if (status === "complete") return "complete";
  return currentStep === "welcome" ? "not_started" : "in_progress";
}

export default function IndexRoute() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const profile = useProfile();
  const access = useAccess();
  const onboardingLaunchState = launchState(onboarding.status, onboarding.currentStep, onboarding.explicitLogoutAt);

  if (auth.phase === "initializing" || !onboarding.hydrated) return <AuthLoadingScreen />;
  if (auth.phase === "authenticated" && profile.status === "loading") return <AuthLoadingScreen message="Preparing your Formie account…" />;

  const destination = resolveLaunchRoute({
    phase: auth.phase,
    onboarding: onboardingLaunchState,
    currentStep: onboarding.currentStep,
    profileComplete: profile.profile?.onboardingCompleted === true,
    profileOnboardingVersion: profile.profile?.onboardingVersion ?? null,
    accessStatus: access.access.status,
  });
  return destination ? <Redirect href={destination as Href} /> : <AuthLoadingScreen />;
}
