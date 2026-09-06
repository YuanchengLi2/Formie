import { act, render, waitFor } from "@testing-library/react-native";
import OnboardingStepRoute from "@/app/onboarding/[step]";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockStartOAuth = jest.fn();
const mockCancelOAuth = jest.fn();
const mockSignInWithApple = jest.fn();
const mockRestore = jest.fn();
const mockOpenUrl = jest.fn();
const mockTrackProductEvent = jest.fn().mockResolvedValue(undefined);
const mockSetStep = jest.fn().mockResolvedValue(undefined);
let mockOnboardingStatus = "profile_sync_required";
let mockStep = "create-account";
let mockAuthPhase = "authenticated";
let mockAcquisitionSource: string | null = null;
let mockApprovedProps: Record<string, unknown> | null = null;

jest.mock("expo-linking", () => ({ openURL: (...args: unknown[]) => mockOpenUrl(...args) }));
jest.mock("expo-router", () => ({
  Redirect: () => null,
  useLocalSearchParams: () => ({ step: mockStep }),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => ({ phase: mockAuthPhase, user: mockAuthPhase === "authenticated" ? { id: "user-1" } : null, signingIn: null, error: null, signInWithApple: mockSignInWithApple }) }));
jest.mock("@/features/auth/legal-config", () => ({ getLegalLinks: () => ({ termsUrl: "https://example.com/terms", privacyUrl: "https://example.com/privacy", retentionUrl: "https://example.com/retention" }) }));
jest.mock("@/features/billing/billing-provider", () => ({ useBilling: () => ({ state: "ready", offering: { packages: [{ identifier: "$rc_monthly" }] }, plans: { monthly: { identifier: "$rc_monthly", productIdentifier: "formie_monthly", priceString: "$9.99", title: "Formie Monthly" }, annual: null }, priceString: "$9.99", error: null, restoreMessage: "Purchase restored.", purchase: jest.fn(), restore: mockRestore }) }));
jest.mock("@/features/analytics/product-analytics", () => ({ trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args) }));
jest.mock("@/features/onboarding/onboarding-store", () => ({ useOnboarding: () => ({
  status: mockOnboardingStatus,
  answers: { acceptedPrivacy: true, acceptedAiProcessing: true, acquisitionSource: mockAcquisitionSource },
  setStep: mockSetStep, updateAnswer: jest.fn(), startOAuth: mockStartOAuth, cancelOAuth: mockCancelOAuth, markLoggedOut: jest.fn(), completeAccess: jest.fn(), markAuthenticated: jest.fn(), requireAccount: jest.fn(),
}) }));
jest.mock("@/features/profile/profile-provider", () => ({ useProfile: () => ({ status: "idle", error: null, retry: jest.fn() }) }));
jest.mock("@/features/referrals/referral-provider", () => ({ useReferral: () => ({ pending: null, method: "creator_code", loading: false, validating: false, validationError: null, validateCode: jest.fn(), claimPending: jest.fn(), clear: jest.fn() }) }));
jest.mock("@/screens/onboarding", () => ({ ApprovedOnboardingScreen: (props: Record<string, unknown>) => { mockApprovedProps = props; return null; } }));

describe("onboarding OAuth routing", () => {
  beforeEach(() => { mockReplace.mockClear(); mockPush.mockClear(); mockOpenUrl.mockClear(); mockTrackProductEvent.mockClear(); mockSetStep.mockClear().mockResolvedValue(undefined); mockRestore.mockReset().mockResolvedValue(true); mockStartOAuth.mockReset().mockResolvedValue(undefined); mockCancelOAuth.mockReset().mockResolvedValue(undefined); mockSignInWithApple.mockReset().mockResolvedValue({ status: "authenticated", userId: "user-1" }); mockApprovedProps = null; mockAuthPhase = "authenticated"; mockOnboardingStatus = "profile_sync_required"; mockStep = "create-account"; mockAcquisitionSource = null; });

  it("keeps an authenticated account on account creation while its profile synchronizes", async () => {
    mockOnboardingStatus = "profile_sync_required";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockReplace).not.toHaveBeenCalledWith("/onboarding/username"));
  });

  it("moves a completed social sign-in to the live pricing route after profile sync", async () => {
    mockStep = "create-account";
    mockOnboardingStatus = "premium_required";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/subscription"));
  });

  it("does not expose unfinished email onboarding", async () => {
    mockAuthPhase = "signed_out";
    mockOnboardingStatus = "account_required";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockApprovedProps).not.toBeNull());
    expect(mockApprovedProps).not.toHaveProperty("onEmail");
    expect(mockPush).not.toHaveBeenCalledWith("/email?intent=onboarding");
  });

  it("uses explicit account-creation intent for Apple signup", async () => {
    mockAuthPhase = "signed_out";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockApprovedProps).not.toBeNull());
    await act(async () => { await (mockApprovedProps?.onOAuth as () => Promise<void>)(); });
    expect(mockStartOAuth).toHaveBeenCalledWith("create_account");
    expect(mockSignInWithApple).toHaveBeenCalledWith("create_account");
  });

  it("routes the welcome-page Sign in button to the existing login screen", async () => {
    mockStep = "welcome";
    mockAuthPhase = "signed_out";
    mockOnboardingStatus = "account_required";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockApprovedProps).not.toBeNull());
    await act(async () => { (mockApprovedProps?.onSignIn as (() => void))(); });
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("forwards restore state and legal actions to the onboarding paywall", async () => {
    mockStep = "premium";
    mockOnboardingStatus = "premium_required";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockApprovedProps).not.toBeNull());

    expect(mockApprovedProps?.restoreMessage).toBe("Purchase restored.");
    await act(async () => { (mockApprovedProps?.onRestore as () => void)(); });
    await act(async () => { (mockApprovedProps?.onOpenTerms as () => void)(); });
    await act(async () => { (mockApprovedProps?.onOpenPrivacy as () => void)(); });

    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockOpenUrl).toHaveBeenNthCalledWith(1, "https://example.com/terms");
    expect(mockOpenUrl).toHaveBeenNthCalledWith(2, "https://example.com/privacy");
  });

  it("records questionnaire completion when a non-creator leaves acquisition", async () => {
    mockStep = "acquisition-source";
    mockAcquisitionSource = "youtube";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockApprovedProps).not.toBeNull());

    mockTrackProductEvent.mockClear();
    await act(async () => { (mockApprovedProps?.onNext as () => void)(); });

    await waitFor(() => expect(mockTrackProductEvent).toHaveBeenCalledWith(
      "onboarding_questionnaire_completed",
      { onboardingVersion: "approved-v1" },
    ));
  });

  it("records creator questionnaire completion only after a validated code page", async () => {
    mockStep = "acquisition-source";
    mockAcquisitionSource = "affiliated_creator";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockApprovedProps).not.toBeNull());
    mockTrackProductEvent.mockClear();
    await act(async () => { (mockApprovedProps?.onNext as () => void)(); });
    expect(mockTrackProductEvent).not.toHaveBeenCalledWith("onboarding_questionnaire_completed", expect.anything());

    mockStep = "creator-code";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockApprovedProps).not.toBeNull());
    mockTrackProductEvent.mockClear();
    await act(async () => { (mockApprovedProps?.onNext as () => void)(); });
    await waitFor(() => expect(mockTrackProductEvent).toHaveBeenCalledWith(
      "onboarding_questionnaire_completed",
      { onboardingVersion: "approved-v1" },
    ));
  });
});
