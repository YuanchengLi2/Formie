/* eslint-disable import/first */
import { Pressable, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockLoad = jest.fn();
const mockUpsertOnboarding = jest.fn();
const mockFinalizeOnboarding = jest.fn();
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

const mockOnboarding: { status: string; ownerUserId: string | null; oauthIntent: string | null; answers: Record<string, unknown>; markProfileSynced: jest.Mock } = {
  status: "complete",
  ownerUserId: "user-1",
  oauthIntent: null,
  answers: {},
  markProfileSynced: jest.fn(),
};
jest.mock("@/features/onboarding/onboarding-store", () => ({
  useOnboarding: () => mockOnboarding,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

const mockReferral = { pending: null as null | { token: string }, method: "creator_code" as const, clear: jest.fn(), claimPending: jest.fn(), validateCode: jest.fn(), validating: false, validationError: null, loading: false };
jest.mock("@/features/referrals/referral-provider", () => ({
  useReferral: () => mockReferral,
}));

jest.mock("@/features/privacy/ai-consent", () => ({
  acceptAiProcessingConsent: (...args: unknown[]) => mockAcceptAiProcessingConsent(...args),
}));

jest.mock("@/features/onboarding/acquisition-reporting", () => ({
  recordOnboardingAcquisition: (...args: unknown[]) => mockRecordAcquisition(...args),
}));

jest.mock("./profile-repository", () => {
  const actual = jest.requireActual("./profile-repository");
  return {
    ...actual,
    loadUserProfile: (...args: unknown[]) => mockLoad(...args),
    upsertOnboardingProfile: (...args: unknown[]) => mockUpsertOnboarding(...args),
    finalizeOnboardingProfile: (...args: unknown[]) => mockFinalizeOnboarding(...args),
    saveUserProfile: (...args: unknown[]) => mockSave(...args),
  };
});

import { ProfileProvider, useProfile } from "./profile-provider";
import { queryClient } from "@/lib/query-client";
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
  afterEach(() => {
    queryClient.clear();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.phase = "authenticated";
    mockAuth.user = { id: "user-1", email: "yuan@example.com", user_metadata: {} };
    mockOnboarding.status = "complete";
    mockOnboarding.ownerUserId = "user-1";
    mockOnboarding.oauthIntent = null;
    mockOnboarding.answers = {};
    mockReferral.pending = null;
    mockReferral.clear.mockResolvedValue(undefined);
    mockRecordAcquisition.mockResolvedValue("response-1");
    mockAcceptAiProcessingConsent.mockResolvedValue({ version: "2026-09-01" });
    mockInvoke.mockResolvedValue({ data: { status: "queued" }, error: null });
  });

  it("loads the authenticated profile and saves editable fields", async () => {
    mockLoad.mockResolvedValue(profile());
    mockSave.mockResolvedValue(profile({
      experience: "advanced",
    }));
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(screen.getByText("Yuan Cheng")).toBeTruthy();
    expect(mockFinalizeOnboarding).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Save Experience"));
    expect(mockSave).toHaveBeenCalledWith(expect.anything(), "user-1", {
      experience: "advanced",
    });
    expect(screen.getByText("ready")).toBeTruthy();
  });

  it("waits for onboarding state to hydrate for the authenticated user before loading a profile", async () => {
    mockOnboarding.ownerUserId = null;
    mockLoad.mockResolvedValue(profile());
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(screen.getByText("loading")).toBeTruthy();
    expect(screen.getByText("no-profile")).toBeTruthy();
    expect(mockLoad).not.toHaveBeenCalled();

    mockOnboarding.ownerUserId = "user-1";
    await screen.rerender(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it("surfaces loading failures and retries without unlocking app routes", async () => {
    mockLoad
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

  it("returns a successful missing-profile read so launch can resume onboarding", async () => {
    mockLoad.mockResolvedValue(null);
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);
    expect(await screen.findByText("ready")).toBeTruthy();
    expect(screen.getByText("no-profile")).toBeTruthy();
    expect(screen.getByText("no-error")).toBeTruthy();
    expect(mockUpsertOnboarding).not.toHaveBeenCalled();
  });

  it("durably records signup AI consent and acquisition before completing authenticated profile sync", async () => {
    mockOnboarding.status = "profile_sync_required";
    mockOnboarding.oauthIntent = "create_account";
    mockOnboarding.answers = { acquisitionSource: "google_search", acquisitionSourceOther: "", acceptedAiProcessing: true };
    mockLoad.mockResolvedValue(null);
    mockUpsertOnboarding.mockResolvedValue(profile());
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(mockAcceptAiProcessingConsent).toHaveBeenCalledWith(expect.anything());
    expect(mockOnboarding.markProfileSynced).toHaveBeenCalled();
    expect(mockUpsertOnboarding).toHaveBeenCalledWith(expect.anything(), mockAuth.user, mockOnboarding.answers);
    expect(mockRecordAcquisition).toHaveBeenCalledWith(expect.anything(), mockOnboarding.answers, expect.any(String));
    expect(mockFinalizeOnboarding).not.toHaveBeenCalled();
    expect(mockAcceptAiProcessingConsent.mock.invocationCallOrder[0]).toBeLessThan(mockOnboarding.markProfileSynced.mock.invocationCallOrder[0]);
  });

  it("trusts an already-complete server profile when local onboarding still requires sync", async () => {
    mockOnboarding.status = "profile_sync_required";
    mockOnboarding.oauthIntent = "create_account";
    mockOnboarding.answers = { acquisitionSource: "google_search", acquisitionSourceOther: "", acceptedAiProcessing: true };
    mockLoad.mockResolvedValue(profile());
    mockFinalizeOnboarding.mockRejectedValue(new Error("referral-context is not deployed"));

    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(screen.getByText("Yuan Cheng")).toBeTruthy();
    expect(mockFinalizeOnboarding).not.toHaveBeenCalled();
    expect(mockRecordAcquisition).toHaveBeenCalled();
    expect(mockOnboarding.markProfileSynced).toHaveBeenCalled();
  });

  it("uses atomic referral finalization only when a new account has a pending referral", async () => {
    mockOnboarding.status = "profile_sync_required";
    mockOnboarding.oauthIntent = "create_account";
    mockOnboarding.answers = { acquisitionSource: "google_search", acquisitionSourceOther: "", acceptedAiProcessing: true };
    mockReferral.pending = { token: "referral-token" };
    mockLoad.mockResolvedValue(null);
    mockFinalizeOnboarding.mockResolvedValue({ profile: profile(), referralState: "attributed" });

    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(mockFinalizeOnboarding).toHaveBeenCalledWith(expect.anything(), mockAuth.user, mockOnboarding.answers, expect.any(String), { token: "referral-token", method: "creator_code" });
    expect(mockUpsertOnboarding).not.toHaveBeenCalled();
    expect(mockRecordAcquisition).not.toHaveBeenCalled();
    expect(mockReferral.clear).toHaveBeenCalled();
  });

  it("does not misreport a post-profile onboarding sync failure as a missing profile", async () => {
    mockOnboarding.status = "profile_sync_required";
    mockOnboarding.oauthIntent = "create_account";
    mockOnboarding.answers = { acquisitionSource: "google_search", acquisitionSourceOther: "", acceptedAiProcessing: true };
    mockLoad.mockResolvedValue(null);
    mockUpsertOnboarding.mockRejectedValue(new Error("profile sync unavailable"));
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("error")).toBeTruthy();
    expect(screen.getByText("no-profile")).toBeTruthy();
    expect(screen.getByText("Your account setup could not be completed. Try again.")).toBeTruthy();
    expect(mockOnboarding.markProfileSynced).not.toHaveBeenCalled();
  });

  it("completes profile sync without recording AI consent when the user deferred it", async () => {
    mockOnboarding.status = "profile_sync_required";
    mockOnboarding.oauthIntent = "create_account";
    mockOnboarding.answers = { acquisitionSource: "youtube", acquisitionSourceOther: "", acceptedAiProcessing: false };
    mockLoad.mockResolvedValue(null);
    mockUpsertOnboarding.mockResolvedValue(profile());
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(mockAcceptAiProcessingConsent).not.toHaveBeenCalled();
    expect(mockOnboarding.markProfileSynced).toHaveBeenCalled();
  });

  it("does not create a profile when an authenticated login session has no profile", async () => {
    mockLoad.mockResolvedValue(null);
    const screen = await render(<ProfileProvider><Probe /></ProfileProvider>);

    expect(await screen.findByText("ready")).toBeTruthy();
    expect(screen.getByText("no-profile")).toBeTruthy();
    expect(mockFinalizeOnboarding).not.toHaveBeenCalled();
  });

});
