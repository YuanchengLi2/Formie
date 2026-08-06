import {
  heightToCm,
  parseOnboardingState,
  weightToKg,
} from "./onboarding-schema";
import { initialOnboardingState } from "./types";

describe("approved onboarding schema", () => {
  it("converts display units to stable canonical metric values", () => {
    expect(heightToCm({ feet: 5, inches: 10 })).toBe(177.8);
    expect(heightToCm({ centimeters: 178 })).toBe(178);
    expect(weightToKg({ pounds: 165 })).toBe(74.84);
    expect(weightToKg({ kilograms: 75 })).toBe(75);
  });

  it("migrates a persisted username screen to direct profile synchronization", () => {
    const versionFour = {
      ...initialOnboardingState,
      schemaVersion: 4,
      currentStep: "username",
      status: "username_required",
      answers: { ...initialOnboardingState.answers, username: "yuan_lifts" },
    };

    expect(parseOnboardingState(versionFour)).toMatchObject({
      schemaVersion: 5,
      currentStep: "create-account",
      status: "profile_sync_required",
    });
    expect(parseOnboardingState(versionFour)?.answers).not.toHaveProperty("username");
  });

  it("accepts a valid versioned draft and rejects corrupt or out-of-range data", () => {
    const valid = {
      ...initialOnboardingState,
      currentStep: "gender",
      answers: { ...initialOnboardingState.answers, ageYears: 27 },
    };

    expect(parseOnboardingState(valid)).toEqual(valid);
    expect(parseOnboardingState({ ...valid, schemaVersion: 1 })).toBeNull();
    expect(parseOnboardingState({
      ...valid,
      answers: { ...valid.answers, ageYears: 8 },
    })).toBeNull();
    expect(parseOnboardingState({
      ...valid,
      answers: { ...valid.answers, customMilestone: "x".repeat(61) },
    })).toBeNull();
  });
});
