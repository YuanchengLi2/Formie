import {
  initialOnboardingState,
  onboardingSteps,
  loggedOutOnboardingState,
  nextOnboardingStep,
  previousOnboardingStep,
  reduceOnboardingState,
} from "./types";
import { isDeviceLogoutReason } from "./onboarding-store";
import { parseOnboardingState } from "./onboarding-schema";

describe("approved onboarding state", () => {
  it("navigates the approved sequence directly from account creation to premium", () => {
    expect(nextOnboardingStep("welcome")).toBe("age");
    expect(nextOnboardingStep("product-demonstration")).toBe("primary-goal");
    expect(nextOnboardingStep("custom-milestone")).toBe("acquisition-source");
    expect(nextOnboardingStep("acquisition-source")).toBe("long-term-value");
    expect(nextOnboardingStep("long-term-value")).toBe("loading");
    expect(nextOnboardingStep("loading")).toBe("create-account");
    expect(nextOnboardingStep("create-account")).toBe("premium");
    expect(previousOnboardingStep("premium")).toBe("create-account");
    expect(previousOnboardingStep("welcome")).toBeNull();
    expect(onboardingSteps).toHaveLength(18);
  });

  it("starts with an unanswered acquisition source", () => {
    expect(initialOnboardingState).toMatchObject({
      schemaVersion: 6,
      answers: { acquisitionSource: null, acquisitionSourceOther: "", acceptedAiProcessing: false },
    });
  });

  it("migrates version 2 state without restarting completed users", () => {
    const legacy = JSON.parse(JSON.stringify(initialOnboardingState));
    legacy.schemaVersion = 2;
    legacy.currentStep = "premium";
    legacy.status = "complete";
    delete legacy.answers.acquisitionSource;
    delete legacy.answers.acquisitionSourceOther;

    expect(parseOnboardingState(legacy)).toMatchObject({
      schemaVersion: 6,
      currentStep: "premium",
      status: "complete",
      answers: { acquisitionSource: null, acquisitionSourceOther: "", acceptedAiProcessing: false },
    });
  });

  it("migrates an interrupted legacy username claim directly to profile sync", () => {
    const legacy = JSON.parse(JSON.stringify(initialOnboardingState));
    legacy.schemaVersion = 2;
    legacy.currentStep = "create-account";
    legacy.status = "profile_sync_required";
    legacy.ownerUserId = "user-1";
    delete legacy.answers.acquisitionSource;
    delete legacy.answers.acquisitionSourceOther;
    delete legacy.answers.username;

    expect(parseOnboardingState(legacy)).toMatchObject({
      schemaVersion: 6,
      currentStep: "create-account",
      status: "profile_sync_required",
    });
  });

  it("records real answers and resumes the exact approved step", () => {
    const answered = reduceOnboardingState(initialOnboardingState, {
      type: "answer_changed",
      field: "ageYears",
      value: 27,
    });
    const resumed = reduceOnboardingState(answered, {
      type: "step_viewed",
      step: "gender",
    });

    expect(resumed).toMatchObject({
      onboardingVersion: "approved-v1",
      currentStep: "gender",
      answers: { ageYears: 27 },
      status: "collecting",
    });
  });

  it("moves from the completed questions to account creation", () => {
    const next = reduceOnboardingState(initialOnboardingState, {
      type: "account_required",
    });

    expect(next).toMatchObject({
      currentStep: "create-account",
      status: "account_required",
    });
  });

  it("syncs the profile immediately after OAuth before premium", () => {
    const account = reduceOnboardingState(initialOnboardingState, { type: "account_required" });
    const oauth = reduceOnboardingState(account, { type: "oauth_started", intent: "create_account" });
    const authenticated = reduceOnboardingState(oauth, { type: "auth_succeeded", userId: "user-1" });
    const synced = reduceOnboardingState(authenticated, { type: "profile_sync_succeeded" });

    expect(authenticated).toMatchObject({
      ownerUserId: "user-1",
      oauthIntent: "create_account",
      currentStep: "create-account",
      status: "profile_sync_required",
    });
    expect(synced).toMatchObject({
      currentStep: "premium",
      status: "premium_required",
    });
  });

  it("completes only after purchase or an existing entitlement", () => {
    const premium = reduceOnboardingState(initialOnboardingState, { type: "profile_sync_succeeded" });
    const complete = reduceOnboardingState(premium, { type: "access_granted", userId: "user-1" });

    expect(complete).toMatchObject({ ownerUserId: "user-1", status: "complete" });
  });

  it("starts a clean account flow from Login", () => {
    const dirty = {
      ...initialOnboardingState,
      answers: { ...initialOnboardingState.answers, ageYears: 42 },
      explicitLogoutAt: "2026-08-04T12:00:00.000Z",
    };

    expect(reduceOnboardingState(dirty, { type: "new_account_started" })).toEqual(initialOnboardingState);
  });

  it("persists an explicit logout marker without pretending onboarding completed", () => {
    expect(loggedOutOnboardingState("2026-08-04T12:00:00.000Z")).toMatchObject({
      status: "collecting",
      explicitLogoutAt: "2026-08-04T12:00:00.000Z",
    });
  });

  it("treats a confirmed invalid session as a device-level logout", () => {
    const reason = "invalid_session";
    expect(isDeviceLogoutReason(reason)).toBe(true);
  });

  it("does not treat subscription expiration as a logout reason", () => {
    expect(isDeviceLogoutReason("subscription_expired")).toBe(false);
  });
});
