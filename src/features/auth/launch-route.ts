import type { AuthPhase } from "./auth-state";
import type { OnboardingStep } from "@/features/onboarding/types";
import type { AccessStatus } from "@/features/access/types";
import type { ProfileStatus } from "@/features/profile/profile-provider";

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
  profileStatus,
  profileComplete,
  adultEligible = true,
  accessStatus,
}: {
  phase: AuthPhase;
  onboarding: OnboardingLaunchState;
  currentStep?: OnboardingStep;
  profileStatus?: ProfileStatus;
  profileComplete: boolean;
  adultEligible?: boolean;
  accessStatus: AccessStatus["status"];
}): string | null {
  if (phase === "initializing") return null;

  if (phase === "signed_out") {
    if (onboarding === "logged_out" || onboarding === "complete") return "/login";
    if (onboarding === "awaiting_account" || onboarding === "profile_sync_required") return "/onboarding/create-account";
    if (onboarding === "in_progress") return `/onboarding/${currentStep ?? "welcome"}`;
    return "/onboarding/welcome";
  }

  // Authentication updates synchronously, while the account-scoped profile is
  // loaded in an effect. Do not interpret that transition frame as a new user.
  if (profileStatus !== undefined && profileStatus !== "ready") return null;

  if (!profileComplete) {
    if (onboarding === "profile_sync_required" || onboarding === "awaiting_account") return "/onboarding/create-account";
    if (onboarding === "in_progress") return `/onboarding/${currentStep ?? "welcome"}`;
    return "/onboarding/welcome";
  }

  if (!adultEligible) return "/account/age-restricted";

  if (accessStatus === "active" || accessStatus === "expired") {
    return "/(tabs)/(home)";
  }
  return "/subscription";
}
