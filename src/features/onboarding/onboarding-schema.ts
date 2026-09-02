import { z } from "zod";

import { onboardingSteps, type OnboardingState } from "./types";

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

export function heightToCm(value: { feet: number; inches: number } | { centimeters: number }): number {
  return "centimeters" in value
    ? rounded(value.centimeters)
    : rounded((value.feet * 12 + value.inches) * 2.54);
}

export function weightToKg(value: { pounds: number } | { kilograms: number }): number {
  return "kilograms" in value ? rounded(value.kilograms) : rounded(value.pounds * 0.45359237);
}

const legacyAnswersSchema = z.object({
  ageYears: z.number().int().min(18).max(100).nullable(),
  gender: z.enum(["male", "female", "prefer_not_to_say"]).nullable(),
  heightCm: z.number().min(100).max(250).nullable(),
  weightKg: z.number().min(25).max(400).nullable(),
  measurementSystem: z.enum(["imperial", "metric"]),
  experience: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  primaryGoal: z.enum(["build_muscle", "get_stronger", "lose_weight", "improve_technique"]).nullable(),
  biggestFrustration: z.enum(["plateau", "unsure_form", "discomfort", "lack_confidence"]).nullable(),
  workoutsPerWeek: z.number().int().min(1).max(7),
  customMilestone: z.string().max(60),
  acceptedPrivacy: z.boolean().default(false),
  marketingOptIn: z.boolean().default(false),
});

const versionThreeAnswersSchema = legacyAnswersSchema.extend({
  acquisitionSource: z.enum(["tiktok", "instagram", "youtube", "app_store_search", "google_search", "friend_trainer_coach", "other"]).nullable(),
  acquisitionSourceOther: z.string().max(80),
});

const answersSchema = versionThreeAnswersSchema;

const onboardingStateSchema = z.object({
  schemaVersion: z.literal(5),
  onboardingVersion: z.literal("approved-v1"),
  ownerUserId: z.string().min(1).nullable(),
  currentStep: z.enum(onboardingSteps),
  answers: answersSchema,
  status: z.enum(["collecting", "account_required", "profile_sync_required", "premium_required", "complete"]),
  oauthIntent: z.enum(["login", "create_account"]).nullable(),
  explicitLogoutAt: z.string().nullable(),
});

const versionFourOnboardingStateSchema = z.object({
  schemaVersion: z.literal(4),
  onboardingVersion: z.literal("approved-v1"),
  ownerUserId: z.string().min(1).nullable(),
  currentStep: z.enum([...onboardingSteps, "username"]),
  answers: versionThreeAnswersSchema.extend({ username: z.string().max(20) }),
  status: z.enum(["collecting", "account_required", "username_required", "profile_sync_required", "premium_required", "complete"]),
  oauthIntent: z.enum(["login", "create_account"]).nullable(),
  explicitLogoutAt: z.string().nullable(),
});

const versionThreeOnboardingStateSchema = z.object({
  schemaVersion: z.literal(3),
  onboardingVersion: z.literal("approved-v1"),
  ownerUserId: z.string().min(1).nullable(),
  currentStep: z.enum([
    "welcome", "age", "product-value", "gender", "height", "why-formie", "weight", "experience",
    "product-demonstration", "primary-goal", "biggest-frustration", "training-frequency", "custom-milestone",
    "acquisition-source", "long-term-value", "loading", "create-account", "premium",
  ]),
  answers: versionThreeAnswersSchema,
  status: z.enum(["collecting", "account_required", "profile_sync_required", "premium_required", "complete"]),
  oauthIntent: z.enum(["login", "create_account"]).nullable(),
  explicitLogoutAt: z.string().nullable(),
});

const legacyOnboardingStateSchema = z.object({
  schemaVersion: z.literal(2),
  onboardingVersion: z.literal("approved-v1"),
  ownerUserId: z.string().min(1).nullable(),
  currentStep: z.enum([
    "welcome", "age", "product-value", "gender", "height", "why-formie", "weight", "experience",
    "product-demonstration", "primary-goal", "biggest-frustration", "training-frequency", "custom-milestone",
    "long-term-value", "loading", "create-account", "premium",
  ]),
  answers: legacyAnswersSchema,
  status: z.enum(["collecting", "account_required", "profile_sync_required", "premium_required", "complete"]),
  oauthIntent: z.enum(["login", "create_account"]).nullable(),
  explicitLogoutAt: z.string().nullable(),
});

export function parseOnboardingState(value: unknown): OnboardingState | null {
  const result = onboardingStateSchema.safeParse(value);
  if (result.success) return result.data;
  const versionFour = versionFourOnboardingStateSchema.safeParse(value);
  if (versionFour.success) {
    const { username: _username, ...answers } = versionFour.data.answers;
    const wasUsernameFlow = versionFour.data.currentStep === "username"
      || versionFour.data.status === "username_required"
      || versionFour.data.status === "profile_sync_required";
    return {
      ...versionFour.data,
      schemaVersion: 5,
      currentStep: wasUsernameFlow ? "create-account" : versionFour.data.currentStep as OnboardingState["currentStep"],
      status: versionFour.data.status === "username_required" ? "profile_sync_required" : versionFour.data.status,
      answers,
    };
  }
  const versionThree = versionThreeOnboardingStateSchema.safeParse(value);
  if (versionThree.success) {
    return {
      ...versionThree.data,
      schemaVersion: 5,
      currentStep: versionThree.data.status === "profile_sync_required" ? "create-account" : versionThree.data.currentStep,
    };
  }
  const legacy = legacyOnboardingStateSchema.safeParse(value);
  if (!legacy.success) return null;
  return {
    ...legacy.data,
    schemaVersion: 5,
    currentStep: legacy.data.status === "profile_sync_required" ? "create-account" : legacy.data.currentStep,
    answers: {
      ...legacy.data.answers,
      acquisitionSource: null,
      acquisitionSourceOther: "",
    },
  };
}
