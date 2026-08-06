export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type PrimaryGoal =
  | "improve_technique"
  | "build_muscle"
  | "get_stronger"
  | "lose_weight"
  | "train_safely";

export type ProfileGender = "male" | "female" | "prefer_not_to_say";
export type BiggestFrustration = "plateau" | "unsure_form" | "discomfort" | "lack_confidence";

export type UserProfile = {
  userId: string;
  displayName: string;
  experience: ExperienceLevel | null;
  primaryGoal: PrimaryGoal | null;
  ageYears: number | null;
  gender: ProfileGender | null;
  heightCm: number | null;
  weightKg: number | null;
  measurementSystem: "imperial" | "metric" | null;
  biggestFrustration: BiggestFrustration | null;
  workoutsPerWeek: number | null;
  customMilestone: string | null;
  onboardingVersion: string | null;
  onboardingCompleted: boolean;
  legalAcceptedAt: string | null;
  marketingOptIn: boolean;
  videoRetentionDays: 30 | null;
  retentionEffectiveAt: string | null;
  createdAt: string;
  updatedAt: string;
};
