export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type PrimaryGoal =
  | "improve_technique"
  | "build_muscle"
  | "get_stronger"
  | "train_safely";

export type UserProfile = {
  userId: string;
  displayName: string;
  experience: ExperienceLevel | null;
  primaryGoal: PrimaryGoal | null;
  legalAcceptedAt: string | null;
  videoRetentionDays: 30 | null;
  retentionEffectiveAt: string | null;
  createdAt: string;
  updatedAt: string;
};
