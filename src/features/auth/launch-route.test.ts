import { resolveLaunchRoute } from "./launch-route";

describe("launch routing", () => {
  it("starts the approved flow on a fresh signed-out install", () => {
    expect(resolveLaunchRoute({
      phase: "signed_out",
      onboarding: "not_started",
      profileComplete: false,
      profileOnboardingVersion: null,
      accessStatus: "unknown",
    } as never)).toBe("/onboarding/welcome");
  });

  it("shows login only after an explicit logout", () => {
    expect(resolveLaunchRoute({
      phase: "signed_out",
      onboarding: "logged_out",
      profileComplete: false,
      profileOnboardingVersion: null,
      accessStatus: "unknown",
    } as never)).toBe("/login");
  });

  it("resumes the exact approved onboarding step", () => {
    expect(resolveLaunchRoute({
      phase: "signed_out",
      onboarding: "in_progress",
      currentStep: "training-frequency",
      profileComplete: false,
      profileOnboardingVersion: null,
      accessStatus: "unknown",
    } as never)).toBe("/onboarding/training-frequency");
  });

  it("does not let a newly-created OAuth identity bypass onboarding", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "in_progress",
      currentStep: "age",
      profileComplete: false,
      profileOnboardingVersion: null,
      accessStatus: "unknown",
    } as never)).toBe("/onboarding/age");
  });

  it("requires account creation, profile sync, and premium in order", () => {
    expect(resolveLaunchRoute({ phase: "signed_out", onboarding: "awaiting_account", profileComplete: false, profileOnboardingVersion: null, accessStatus: "unknown" } as never)).toBe("/onboarding/create-account");
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "profile_sync_required", currentStep: "create-account", profileComplete: false, profileOnboardingVersion: null, accessStatus: "unknown" } as never)).toBe("/onboarding/create-account");
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "premium_required", profileComplete: true, profileOnboardingVersion: "approved-v1", accessStatus: "expired" } as never)).toBe("/subscription");
  });

  it("starts approved onboarding for a restored legacy profile instead of opening Pricing", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "not_started",
      currentStep: "welcome",
      profileComplete: true,
      profileOnboardingVersion: "legacy-complete-v1",
      accessStatus: "expired",
    })).toBe("/onboarding/welcome");
  });

  it("admits only a completed authenticated account", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "complete",
      profileComplete: true,
      profileOnboardingVersion: "approved-v1",
      accessStatus: "active",
    } as never)).toBe("/(tabs)/(home)");
  });

  it("routes an expired completed subscriber home with paid analysis controls locked", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "complete",
      profileComplete: true,
      profileOnboardingVersion: "approved-v1",
      accessStatus: "expired",
    } as never)).toBe("/(tabs)/(home)");
  });

  it("lets confirmed access override a stale local premium-required flag", () => {
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "premium_required", profileComplete: true, profileOnboardingVersion: "approved-v1", accessStatus: "active" })).toBe("/(tabs)/(home)");
  });

  it("keeps a completed account on the subscription verification route while access is unresolved", () => {
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "complete", profileComplete: true, profileOnboardingVersion: "approved-v1", accessStatus: "unknown" })).toBe("/subscription");
  });

  it("does not strand a reauthenticated completed user on a stale logout marker", () => {
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "logged_out", profileComplete: true, profileOnboardingVersion: "approved-v1", accessStatus: "expired" })).toBe("/(tabs)/(home)");
  });
});
