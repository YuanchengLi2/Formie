import type { User } from "@supabase/supabase-js";
import { initialOnboardingAnswers } from "@/features/onboarding/types";

import {
  createInitialProfileRow,
  loadOrCreateUserProfile,
  profileFromRow,
  saveUserProfile,
  type UserProfileClient,
  type UserProfileRow,
} from "./profile-repository";

describe("profile repository", () => {
  it("builds one completed owner row from the approved onboarding answers", () => {
    const row = (createInitialProfileRow as unknown as (user: User, answers: unknown) => UserProfileRow)(user(), {
      ...initialOnboardingAnswers,
      ageYears: 27,
      gender: "prefer_not_to_say",
      heightCm: 177.8,
      weightKg: 74.84,
      experience: "intermediate",
      primaryGoal: "lose_weight",
      biggestFrustration: "unsure_form",
      workoutsPerWeek: 4,
      customMilestone: "Bench 225 lb",
      acquisitionSource: "instagram",
      acceptedPrivacy: true,
      marketingOptIn: true,
    });

    expect(row).toMatchObject({
      user_id: "user-1",
      age_years: 27,
      gender: "prefer_not_to_say",
      height_cm: 177.8,
      weight_kg: 74.84,
      measurement_system: "imperial",
      experience: "intermediate",
      primary_goal: "lose_weight",
      biggest_frustration: "unsure_form",
      workouts_per_week: 4,
      custom_milestone: "Bench 225 lb",
      onboarding_version: "approved-v1",
      onboarding_step: "complete",
      onboarding_completed: true,
      legal_accepted_at: expect.any(String),
      marketing_opt_in: true,
      onboarding_completed_at: expect.any(String),
    });
  });

  it("does not mark a missing OAuth profile complete before onboarding answers are synced", () => {
    const row = createInitialProfileRow(user());

    expect(row).toMatchObject({
      onboarding_completed: false,
      onboarding_step: "welcome",
      onboarding_completed_at: null,
    });
  });

  it("creates an incomplete initial profile from OAuth metadata", () => {
    const user = {
      id: "user-1",
      email: "yuan@example.com",
      user_metadata: {
        display_name: "Yuan Cheng",
        legal_accepted_at: "2026-07-23T22:45:00.000Z",
      },
    } as unknown as User;

    expect(createInitialProfileRow(user)).toMatchObject({
      user_id: "user-1",
      display_name: "Yuan Cheng",
      legal_accepted_at: "2026-07-23T22:45:00.000Z",
      experience: null,
      primary_goal: null,
      onboarding_step: "welcome",
      onboarding_completed: false,
      onboarding_completed_at: null,
    });
  });

  it("uses a safe legacy display name and maps database rows to app types", () => {
    const legacyUser = { id: "user-2", email: "a@example.com", user_metadata: {} } as User;
    expect(createInitialProfileRow(legacyUser).display_name).toBe("Formie Athlete");

    const row: UserProfileRow = {
      user_id: "user-1",
      display_name: "Yuan Cheng",
      experience: "intermediate",
      primary_goal: "improve_technique",
      age_years: null,
      gender: null,
      height_cm: null,
      weight_kg: null,
      measurement_system: null,
      biggest_frustration: null,
      workouts_per_week: null,
      custom_milestone: null,
      onboarding_version: null,
      onboarding_step: "first_analysis",
      onboarding_completed: false,
      legal_accepted_at: "2026-07-23T22:45:00.000Z",
      onboarding_completed_at: null,
      video_retention_days: 30,
      retention_effective_at: "2026-07-24T12:00:00.000Z",
      created_at: "2026-07-23T22:45:00.000Z",
      updated_at: "2026-07-23T22:45:00.000Z",
    };

    expect(profileFromRow(row)).toEqual({
      userId: "user-1",
      displayName: "Yuan Cheng",
      experience: "intermediate",
      primaryGoal: "improve_technique",
      ageYears: null,
      gender: null,
      heightCm: null,
      weightKg: null,
      measurementSystem: null,
      biggestFrustration: null,
      workoutsPerWeek: null,
      customMilestone: null,
      onboardingVersion: null,
      onboardingCompleted: false,
      legalAcceptedAt: "2026-07-23T22:45:00.000Z",
      marketingOptIn: false,
      videoRetentionDays: 30,
      retentionEffectiveAt: "2026-07-24T12:00:00.000Z",
      createdAt: "2026-07-23T22:45:00.000Z",
      updatedAt: "2026-07-23T22:45:00.000Z",
    });
  });

  it("loads an existing profile without creating a replacement", async () => {
    const row = profileRow();
    const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
    const upsert = jest.fn();
    const client = clientWith({ maybeSingle, upsert });

    await expect(loadOrCreateUserProfile(client, user())).resolves.toEqual(profileFromRow(row));
    expect(upsert).not.toHaveBeenCalled();
  });

  it("atomically creates a completed missing profile from the authenticated onboarding draft", async () => {
    const answers = {
      ...initialOnboardingAnswers,
      ageYears: 27,
      gender: "male" as const,
      heightCm: 177.8,
      weightKg: 74.84,
      experience: "intermediate" as const,
      primaryGoal: "get_stronger" as const,
      biggestFrustration: "unsure_form" as const,
      customMilestone: "Bench 225 lb",
      acquisitionSource: "youtube" as const,
      acceptedPrivacy: true,
    };
    const completed = {
      ...createInitialProfileRow(user(), answers),
      created_at: "2026-08-04T12:00:00.000Z",
      updated_at: "2026-08-04T12:00:00.000Z",
    };
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const single = jest.fn().mockResolvedValue({ data: completed, error: null });
    const upsert = jest.fn(() => ({ select: () => ({ single }) }));
    const client = clientWith({ maybeSingle, upsert });

    await (loadOrCreateUserProfile as unknown as (client: UserProfileClient, user: User, answers: unknown) => Promise<unknown>)(client, user(), answers);

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      age_years: 27,
      onboarding_version: "approved-v1",
      onboarding_step: "complete",
      onboarding_completed: true,
    }), { onConflict: "user_id" });
    expect((upsert as jest.Mock).mock.calls[0][0]).not.toHaveProperty("username");
  });

  it("upgrades an existing incomplete OAuth profile when the completed draft arrives", async () => {
    const answers = {
      ...initialOnboardingAnswers,
      ageYears: 27,
      gender: "female" as const,
      heightCm: 165,
      weightKg: 62,
      experience: "advanced" as const,
      primaryGoal: "improve_technique" as const,
      biggestFrustration: "lack_confidence" as const,
      customMilestone: "Improve squat depth",
      acquisitionSource: "friend_trainer_coach" as const,
      acceptedPrivacy: true,
    };
    const incomplete = profileRow();
    const complete = {
      ...incomplete,
      ...createInitialProfileRow(user(), answers),
    };
    const maybeSingle = jest.fn().mockResolvedValue({ data: incomplete, error: null });
    const single = jest.fn().mockResolvedValue({ data: complete, error: null });
    const upsert = jest.fn(() => ({ select: () => ({ single }) }));
    const client = clientWith({ maybeSingle, upsert });

    await loadOrCreateUserProfile(client, user(), answers);

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      gender: "female",
      onboarding_completed: true,
    }), { onConflict: "user_id" });
  });

  it("creates a missing profile and saves editable profile fields", async () => {
    const initial = profileRow();
    const advanced = { ...initial, experience: "advanced" as const };
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const single = jest.fn()
      .mockResolvedValueOnce({ data: initial, error: null })
      .mockResolvedValueOnce({ data: advanced, error: null });
    const upsert = jest.fn(() => ({ select: () => ({ single }) }));
    const update = jest.fn(() => ({ eq: () => ({ select: () => ({ single }) }) }));
    const client = clientWith({ maybeSingle, upsert, update });

    await expect(loadOrCreateUserProfile(client, user())).resolves.toEqual(profileFromRow(initial));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      onboarding_step: "welcome",
      onboarding_completed: false,
    }), { onConflict: "user_id" });

    await expect(saveUserProfile(client, "user-1", {
      experience: "advanced",
    })).resolves.toEqual(profileFromRow(advanced));
    expect(update).toHaveBeenCalledWith({
      experience: "advanced",
    });
  });

  it("stores retention opt-in and effective time without changing older recordings", async () => {
    const retained = {
      ...profileRow(),
      video_retention_days: 30 as const,
      retention_effective_at: "2026-07-24T12:00:00.000Z",
    };
    const single = jest.fn().mockResolvedValue({ data: retained, error: null });
    const update = jest.fn(() => ({ eq: () => ({ select: () => ({ single }) }) }));
    const client = clientWith({ maybeSingle: jest.fn(), update });

    await expect(saveUserProfile(client, "user-1", {
      videoRetentionDays: 30,
      retentionEffectiveAt: "2026-07-24T12:00:00.000Z",
    })).resolves.toMatchObject({
      videoRetentionDays: 30,
      retentionEffectiveAt: "2026-07-24T12:00:00.000Z",
    });
    expect(update).toHaveBeenCalledWith({
      video_retention_days: 30,
      retention_effective_at: "2026-07-24T12:00:00.000Z",
    });
  });
});

function user(): User {
  return {
    id: "user-1",
    email: "yuan@example.com",
    user_metadata: {
      display_name: "Yuan Cheng",
      legal_accepted_at: "2026-07-23T22:45:00.000Z",
    },
  } as unknown as User;
}

function profileRow(): UserProfileRow {
  return {
    ...createInitialProfileRow(user()),
    created_at: "2026-07-23T22:45:00.000Z",
    updated_at: "2026-07-23T22:45:00.000Z",
  };
}

function clientWith(operations: {
  maybeSingle: jest.Mock;
  upsert?: jest.Mock;
  update?: jest.Mock;
}): UserProfileClient {
  return {
    from: jest.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: operations.maybeSingle }) }),
      upsert: operations.upsert ?? jest.fn(),
      update: operations.update ?? jest.fn(),
    })),
  };
}
