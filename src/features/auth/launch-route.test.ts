import { resolveLaunchRoute } from "./launch-route";

describe("launch routing", () => {
  it("blocks a completed legacy under-18 account before subscription or analysis access", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "complete",
      profileComplete: true,
      adultEligible: false,
      accessStatus: "active",
    })).toBe("/account/age-restricted");
  });

  it("starts the approved flow on a fresh signed-out install", () => {
    expect(resolveLaunchRoute({
      phase: "signed_out",
      onboarding: "not_started",
      profileComplete: false,
      accessStatus: "unknown",
    } as never)).toBe("/onboarding/welcome");
  });

  it("shows login only after an explicit logout", () => {
    expect(resolveLaunchRoute({
      phase: "signed_out",
      onboarding: "logged_out",
      profileComplete: false,
      accessStatus: "unknown",
    } as never)).toBe("/login");
  });

  it("resumes the exact approved onboarding step", () => {
    expect(resolveLaunchRoute({
      phase: "signed_out",
      onboarding: "in_progress",
      currentStep: "training-frequency",
      profileComplete: false,
      accessStatus: "unknown",
    } as never)).toBe("/onboarding/training-frequency");
  });

  it("does not let a newly-created OAuth identity bypass onboarding", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "in_progress",
      currentStep: "age",
      profileComplete: false,
      accessStatus: "unknown",
    } as never)).toBe("/onboarding/age");
  });

  it("starts onboarding for an authenticated identity whose profile does not exist yet", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "not_started",
      currentStep: "welcome",
      profileComplete: false,
      accessStatus: "unknown",
    })).toBe("/onboarding/welcome");
  });

  it("starts onboarding after reauthentication when the account profile is incomplete", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "logged_out",
      currentStep: "welcome",
      profileComplete: false,
      accessStatus: "unknown",
    })).toBe("/onboarding/welcome");
  });

  it("does not restart onboarding for a completed legacy account while access resolves", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "not_started",
      currentStep: "welcome",
      profileComplete: true,
      accessStatus: "unknown",
    })).toBe("/subscription");
  });

  it("requires account creation and profile sync in order", () => {
    expect(resolveLaunchRoute({ phase: "signed_out", onboarding: "awaiting_account", profileComplete: false, accessStatus: "unknown" } as never)).toBe("/onboarding/create-account");
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "profile_sync_required", currentStep: "create-account", profileComplete: false, accessStatus: "unknown" } as never)).toBe("/onboarding/create-account");
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "premium_required", profileComplete: true, accessStatus: "expired" } as never)).toBe("/(tabs)/(home)");
  });

  it("opens a restored completed legacy profile without restarting onboarding", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "not_started",
      currentStep: "welcome",
      profileComplete: true,
      accessStatus: "expired",
    })).toBe("/(tabs)/(home)");
  });

  it("admits only a completed authenticated account", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "complete",
      profileComplete: true,
      accessStatus: "active",
    } as never)).toBe("/(tabs)/(home)");
  });

  it("routes an expired completed subscriber home with paid analysis controls locked", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "complete",
      profileComplete: true,
      accessStatus: "expired",
    } as never)).toBe("/(tabs)/(home)");
  });

  it("does not let a stale premium-required marker override a completed profile", () => {
    expect(resolveLaunchRoute({
      phase: "authenticated",
      onboarding: "premium_required",
      profileComplete: true,
      accessStatus: "expired",
    })).toBe("/(tabs)/(home)");
  });

  it("lets confirmed access override a stale local premium-required flag", () => {
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "premium_required", profileComplete: true, accessStatus: "active" })).toBe("/(tabs)/(home)");
  });

  it("keeps a completed account on the subscription verification route while access is unresolved", () => {
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "complete", profileComplete: true, accessStatus: "unknown" })).toBe("/subscription");
  });

  it("does not strand a reauthenticated completed user on a stale logout marker", () => {
    expect(resolveLaunchRoute({ phase: "authenticated", onboarding: "logged_out", profileComplete: true, accessStatus: "expired" })).toBe("/(tabs)/(home)");
  });
});
