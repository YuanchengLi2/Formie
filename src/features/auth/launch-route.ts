import type { AuthPhase } from "./auth-state";
import type { OnboardingStep } from "@/features/onboarding/types";
import type { AccessStatus } from "@/features/access/types";

export type OnboardingLaunchState =
  | "not_started"
  | "in_progress"
  | "awaiting_account"
  | "profile_sync_required"
  | "premium_required"
  | "logged_out"
  | "complete";

export function resolveLaunchRoute({
  phase,
  onboarding,
  currentStep,
  profileComplete,
  accessStatus,
}: {
  phase: AuthPhase;
  onboarding: OnboardingLaunchState;
  currentStep?: OnboardingStep;
  profileComplete: boolean;
  accessStatus: AccessStatus["status"];
}): string | null {
  if (phase === "initializing") return null;

  if (phase === "signed_out") {
    if (onboarding === "logged_out" || onboarding === "complete") return "/login";
    if (onboarding === "awaiting_account" || onboarding === "profile_sync_required") return "/onboarding/create-account";
    if (onboarding === "in_progress") return `/onboarding/${currentStep ?? "welcome"}`;
    return "/onboarding/welcome";
  }

  if (!profileComplete) {
    if (onboarding === "profile_sync_required" || onboarding === "awaiting_account") return "/onboarding/create-account";
    if (onboarding === "in_progress") return `/onboarding/${currentStep ?? "welcome"}`;
    return "/onboarding/welcome";
  }

  if (accessStatus === "active" || accessStatus === "expired") {
    return "/(tabs)/(home)";
  }
  return "/subscription";
}
