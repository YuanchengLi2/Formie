import {
  initialOnboardingState,
  reduceOnboardingState,
  resolveOnboardingStateForUser,
} from "./types";

describe("account-scoped approved onboarding", () => {
  it("does not give one account's completed flow to another account", () => {
    const accountA = reduceOnboardingState(initialOnboardingState, {
      type: "access_granted",
      userId: "user-a",
    });

    const accountB = resolveOnboardingStateForUser(accountA, initialOnboardingState, "user-b");

    expect(accountB).toMatchObject({ ownerUserId: "user-b", status: "collecting" });
    expect(accountB.answers).toEqual(initialOnboardingState.answers);
  });

  it("attaches a completed signed-out draft only to the account created from it", () => {
    const answered = reduceOnboardingState(initialOnboardingState, {
      type: "answer_changed",
      field: "ageYears",
      value: 27,
    });
    const accountRequired = reduceOnboardingState(answered, { type: "account_required" });
    const oauth = reduceOnboardingState(accountRequired, { type: "oauth_started", intent: "create_account" });

    expect(resolveOnboardingStateForUser(null, oauth, "user-a")).toMatchObject({
      ownerUserId: "user-a",
      currentStep: "create-account",
      status: "profile_sync_required",
      answers: { ageYears: 27 },
    });
  });

  it("does not import an abandoned signed-out draft during ordinary login", () => {
    const abandoned = reduceOnboardingState(initialOnboardingState, {
      type: "answer_changed",
      field: "customMilestone",
      value: "Bench 225 lb",
    });
    const login = reduceOnboardingState(abandoned, { type: "oauth_started", intent: "login" });

    expect(resolveOnboardingStateForUser(null, login, "user-a")).toMatchObject({
      ownerUserId: "user-a",
      status: "collecting",
      answers: { customMilestone: "" },
    });
  });

  it("does not revive a stale account-scoped onboarding flow during ordinary login", () => {
    const staleScoped = {
      ...reduceOnboardingState(initialOnboardingState, { type: "step_viewed", step: "age" }),
      ownerUserId: "user-a",
    };
    const login = reduceOnboardingState(initialOnboardingState, { type: "oauth_started", intent: "login" });

    expect(resolveOnboardingStateForUser(staleScoped, login, "user-a")).toMatchObject({
      ownerUserId: "user-a",
      currentStep: "welcome",
      status: "collecting",
      oauthIntent: null,
    });
  });
});
