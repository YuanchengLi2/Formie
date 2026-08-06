import type { User } from "@supabase/supabase-js";

import type { OnboardingAnswers } from "@/features/onboarding/types";

import type {
  ExperienceLevel,
  PrimaryGoal,
  UserProfile,
} from "./types";

type LegacyOnboardingStep =
  | "welcome"
  | "how_it_works"
  | "experience"
  | "primary_goal"
  | "first_analysis"
  | "complete";

export type UserProfileRow = {
  user_id: string;
  display_name: string;
  experience: ExperienceLevel | null;
  primary_goal: PrimaryGoal | null;
  age_years: number | null;
  gender: UserProfile["gender"];
  height_cm: number | null;
  weight_kg: number | null;
  measurement_system: UserProfile["measurementSystem"];
  biggest_frustration: UserProfile["biggestFrustration"];
  workouts_per_week: number | null;
  custom_milestone: string | null;
  onboarding_version: string | null;
  onboarding_step: LegacyOnboardingStep;
  onboarding_completed: boolean;
  legal_accepted_at: string | null;
  marketing_opt_in?: boolean;
  onboarding_completed_at: string | null;
  video_retention_days: 30 | null;
  retention_effective_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileResult = Promise<{
  data: UserProfileRow | null;
  error: { message?: string; code?: string } | null;
}>;

type ProfileWrite = {
  select: () => { single: () => ProfileResult };
};

export type UserProfileClient = {
  from: (table: "user_profiles") => {
    select: (columns: "*") => {
      eq: (column: "user_id", userId: string) => {
        maybeSingle: () => ProfileResult;
      };
    };
    upsert: (
      row: Omit<UserProfileRow, "created_at" | "updated_at">,
      options: { onConflict: "user_id" },
    ) => ProfileWrite;
    update: (row: Partial<UserProfileRow>) => {
      eq: (column: "user_id", userId: string) => ProfileWrite;
    };
  };
};

export type UserProfilePatch = Partial<Pick<
  UserProfile,
  | "displayName"
  | "experience"
  | "primaryGoal"
  | "videoRetentionDays"
  | "retentionEffectiveAt"
>>;

function metadataString(user: User, key: string): string | null {
  const value = user.user_metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function legacyDisplayName(user: User): string {
  const metadataName = metadataString(user, "display_name");
  if (metadataName && metadataName.length >= 2) return metadataName.slice(0, 60);
  const emailName = user.email?.split("@")[0]?.trim();
  if (emailName && emailName.length >= 2) return emailName.slice(0, 60);
  return "Formie Athlete";
}

export function createInitialProfileRow(user: User, answers?: OnboardingAnswers): Omit<UserProfileRow, "created_at" | "updated_at"> {
  const createdAt = new Date().toISOString();
  const complete = Boolean(
    answers?.ageYears
    && answers.gender
    && answers.heightCm
    && answers.weightKg
    && answers.experience
    && answers.primaryGoal
    && answers.biggestFrustration
    && answers.customMilestone.trim()
    && answers.acquisitionSource
    && (answers.acquisitionSource !== "other" || answers.acquisitionSourceOther.trim())
    && answers.acceptedPrivacy,
  );
  return {
    user_id: user.id,
    display_name: legacyDisplayName(user),
    experience: answers?.experience ?? null,
    primary_goal: answers?.primaryGoal ?? null,
    age_years: answers?.ageYears ?? null,
    gender: answers?.gender ?? null,
    height_cm: answers?.heightCm ?? null,
    weight_kg: answers?.weightKg ?? null,
    measurement_system: answers?.measurementSystem ?? null,
    biggest_frustration: answers?.biggestFrustration ?? null,
    workouts_per_week: answers?.workoutsPerWeek ?? null,
    custom_milestone: answers?.customMilestone.trim() || null,
    onboarding_version: complete ? "approved-v1" : null,
    onboarding_step: complete ? "complete" : "welcome",
    onboarding_completed: complete,
    legal_accepted_at: answers?.acceptedPrivacy ? createdAt : metadataString(user, "legal_accepted_at"),
    marketing_opt_in: answers?.marketingOptIn ?? false,
    onboarding_completed_at: complete ? createdAt : null,
    video_retention_days: null,
    retention_effective_at: null,
  };
}

export function profileFromRow(row: UserProfileRow): UserProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    experience: row.experience,
    primaryGoal: row.primary_goal,
    ageYears: row.age_years,
    gender: row.gender,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    measurementSystem: row.measurement_system,
    biggestFrustration: row.biggest_frustration,
    workoutsPerWeek: row.workouts_per_week,
    customMilestone: row.custom_milestone,
    onboardingVersion: row.onboarding_version,
    onboardingCompleted: row.onboarding_completed,
    legalAcceptedAt: row.legal_accepted_at,
    marketingOptIn: row.marketing_opt_in ?? false,
    videoRetentionDays: row.video_retention_days,
    retentionEffectiveAt: row.retention_effective_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireProfile(
  result: { data: UserProfileRow | null; error: { message?: string; code?: string } | null },
  fallbackMessage: string,
): UserProfile {
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? fallbackMessage);
  }
  return profileFromRow(result.data);
}

export async function loadOrCreateUserProfile(
  client: UserProfileClient,
  user: User,
  onboardingAnswers?: OnboardingAnswers,
): Promise<UserProfile> {
  const existing = await client
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message ?? "Your profile could not be loaded.");
  if (existing.data && (!onboardingAnswers || existing.data.onboarding_completed)) {
    return profileFromRow(existing.data);
  }

  const created = await client
    .from("user_profiles")
    .upsert(createInitialProfileRow(user, onboardingAnswers), { onConflict: "user_id" })
    .select()
    .single();
  return requireProfile(created, "Your profile could not be created.");
}

export async function saveUserProfile(
  client: UserProfileClient,
  userId: string,
  patch: UserProfilePatch,
): Promise<UserProfile> {
  const row: Partial<UserProfileRow> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.experience !== undefined) row.experience = patch.experience;
  if (patch.primaryGoal !== undefined) row.primary_goal = patch.primaryGoal;
  if (patch.videoRetentionDays !== undefined) row.video_retention_days = patch.videoRetentionDays;
  if (patch.retentionEffectiveAt !== undefined) row.retention_effective_at = patch.retentionEffectiveAt;

  const saved = await client
    .from("user_profiles")
    .update(row)
    .eq("user_id", userId)
    .select()
    .single();
  return requireProfile(saved, "Your profile could not be saved.");
}
