/* eslint-disable import/first */
import { Pressable, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockLoadOrCreate = jest.fn();
const mockSave = jest.fn();
const mockAuth = {
  phase: "authenticated",
  user: { id: "user-1", email: "yuan@example.com", user_metadata: {} },
};

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn() },
}));

jest.mock("./profile-repository", () => {
  const actual = jest.requireActual("./profile-repository");
  return {
    ...actual,
    loadOrCreateUserProfile: (...args: unknown[]) => mockLoadOrCreate(...args),
    saveUserProfile: (...args: unknown[]) => mockSave(...args),
  };
});

import { ProfileProvider, useProfile } from "./profile-provider";
import type { UserProfile } from "./types";

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    userId: "user-1",
    displayName: "Yuan Cheng",
    experience: null,
    primaryGoal: null,
    legalAcceptedAt: "2026-07-23T22:45:00.000Z",
    videoRetentionDays: null,
    retentionEffectiveAt: null,
    createdAt: "2026-07-23T22:45:00.000Z",
    updatedAt: "2026-07-23T22:45:00.000Z",
    ...overrides,
  };
}

function Probe() {
  const profileState = useProfile();
  return (
    <>
      <Text>{profileState.status}</Text>
      <Text>{profileState.profile?.displayName ?? "no-profile"}</Text>
      <Text>{profileState.error ?? "no-error"}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void profileState.saveProfile({
          experience: "advanced",
        })}
      >
        <Text>Save Experience</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={profileState.retry}>
        <Text>Retry</Text>
      </Pressable>
    </>
  );
}

describe("ProfileProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.phase = "authenticated";
    mockAuth.user = { id: "user-1", email: "yuan@example.com", user_metadata: {} };
  });

  it("loads the authenticated profile and saves editable fields", async () => {
    mockLoadOrCreate.mockResolvedValue(profile());
    mockSave.mockResolvedValue(profile({
      experience: "advanced",
    }));
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(screen.getByText("Yuan Cheng")).toBeTruthy();

    await fireEvent.press(screen.getByText("Save Experience"));
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), "user-1", {
      experience: "advanced",
    });
    expect(screen.getByText("ready")).toBeTruthy();
  });

  it("surfaces loading failures and retries without unlocking app routes", async () => {
    mockLoadOrCreate
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce(profile());
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("error")).toBeTruthy();
    expect(screen.getByText("Your profile could not be loaded. Try again.")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText("Retry"));
    });
    expect(await screen.findByText("ready")).toBeTruthy();
  });
});
