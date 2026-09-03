/* eslint-disable import/first */
import { Pressable, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockLoadOrCreate = jest.fn();
const mockSave = jest.fn();
const mockRecordAcquisition = jest.fn();
const mockAcceptAiProcessingConsent = jest.fn();
const mockInvoke = jest.fn();
const mockAuth = {
  phase: "authenticated",
  user: { id: "user-1", email: "yuan@example.com", user_metadata: {} },
};

jest.mock("@/features/auth/auth-provider", () => ({
  useAuth: () => mockAuth,
}));

const mockOnboarding: { status: string; answers: Record<string, unknown>; markProfileSynced: jest.Mock } = {
  status: "complete",
  answers: {},
  markProfileSynced: jest.fn(),
};
jest.mock("@/features/onboarding/onboarding-store", () => ({
  useOnboarding: () => mockOnboarding,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

jest.mock("@/features/onboarding/acquisition-reporting", () => ({
  recordOnboardingAcquisition: (...args: unknown[]) => mockRecordAcquisition(...args),
}));

jest.mock("@/features/privacy/ai-consent", () => ({
  acceptAiProcessingConsent: (...args: unknown[]) => mockAcceptAiProcessingConsent(...args),
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
    ageYears: null,
    gender: null,
    heightCm: null,
    weightKg: null,
    measurementSystem: null,
    biggestFrustration: null,
    workoutsPerWeek: null,
    customMilestone: null,
    onboardingVersion: "approved-v1",
    onboardingCompleted: true,
    legalAcceptedAt: "2026-07-23T22:45:00.000Z",
    marketingOptIn: false,
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
    mockOnboarding.status = "complete";
    mockOnboarding.answers = {};
    mockRecordAcquisition.mockResolvedValue("response-1");
    mockAcceptAiProcessingConsent.mockResolvedValue({ version: "2026-09-01" });
    mockInvoke.mockResolvedValue({ data: { status: "queued" }, error: null });
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

  it("durably records signup AI consent and acquisition before completing authenticated profile sync", async () => {
    mockOnboarding.status = "profile_sync_required";
    mockOnboarding.answers = { acquisitionSource: "google_search", acquisitionSourceOther: "", acceptedAiProcessing: true };
    mockLoadOrCreate.mockResolvedValue(profile());
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(mockRecordAcquisition).toHaveBeenCalledWith(expect.anything(), mockOnboarding.answers, expect.any(String));
    expect(mockAcceptAiProcessingConsent).toHaveBeenCalledWith(expect.anything());
    expect(mockOnboarding.markProfileSynced).toHaveBeenCalled();
    expect(mockAcceptAiProcessingConsent.mock.invocationCallOrder[0]).toBeLessThan(mockOnboarding.markProfileSynced.mock.invocationCallOrder[0]);
  });

  it("completes profile sync without recording AI consent when the user deferred it", async () => {
    mockOnboarding.status = "profile_sync_required";
    mockOnboarding.answers = { acquisitionSource: null, acquisitionSourceOther: "", acceptedAiProcessing: false };
    mockLoadOrCreate.mockResolvedValue(profile());
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(mockAcceptAiProcessingConsent).not.toHaveBeenCalled();
    expect(mockOnboarding.markProfileSynced).toHaveBeenCalled();
  });

});
