import type { User } from "@supabase/supabase-js";

import {
  createInitialProfileRow,
  loadOrCreateUserProfile,
  profileFromRow,
  saveUserProfile,
  type UserProfileClient,
  type UserProfileRow,
} from "./profile-repository";

describe("profile repository", () => {
  it("creates a completed initial profile from verified signup metadata", () => {
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
      onboarding_step: "complete",
      onboarding_completed: true,
      onboarding_completed_at: expect.any(String),
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
      legalAcceptedAt: "2026-07-23T22:45:00.000Z",
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
      onboarding_step: "complete",
      onboarding_completed: true,
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
