import { act, render, waitFor } from "@testing-library/react-native";
import OnboardingStepRoute from "@/app/onboarding/[step]";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockStartOAuth = jest.fn();
const mockRestore = jest.fn();
const mockOpenUrl = jest.fn();
let mockOnboardingStatus = "profile_sync_required";
let mockStep = "create-account";
let mockAuthPhase = "authenticated";
let mockApprovedProps: Record<string, unknown> | null = null;

jest.mock("expo-linking", () => ({ openURL: (...args: unknown[]) => mockOpenUrl(...args) }));
jest.mock("expo-router", () => ({
  Redirect: () => null,
  useLocalSearchParams: () => ({ step: mockStep }),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => ({ phase: mockAuthPhase, user: mockAuthPhase === "authenticated" ? { id: "user-1" } : null, signingIn: null, error: null, signInWithProvider: jest.fn() }) }));
jest.mock("@/features/auth/legal-config", () => ({ getLegalLinks: () => ({ termsUrl: "https://example.com/terms", privacyUrl: "https://example.com/privacy", retentionUrl: "https://example.com/retention" }) }));
jest.mock("@/features/billing/billing-provider", () => ({ useBilling: () => ({ state: "ready", offering: { packages: [{ identifier: "$rc_monthly" }] }, plans: { monthly: { identifier: "$rc_monthly", productIdentifier: "formie_monthly", priceString: "$9.99", title: "Formie Monthly" }, annual: null }, priceString: "$9.99", error: null, restoreMessage: "Purchase restored.", purchase: jest.fn(), restore: mockRestore }) }));
jest.mock("@/features/onboarding/onboarding-store", () => ({ useOnboarding: () => ({
  status: mockOnboardingStatus,
  answers: { acceptedPrivacy: true },
  setStep: jest.fn(), updateAnswer: jest.fn(), startOAuth: mockStartOAuth, markLoggedOut: jest.fn(), completeAccess: jest.fn(), markAuthenticated: jest.fn(), requireAccount: jest.fn(),
}) }));
jest.mock("@/features/profile/profile-provider", () => ({ useProfile: () => ({ status: "idle", error: null, retry: jest.fn() }) }));
jest.mock("@/screens/onboarding", () => ({ ApprovedOnboardingScreen: (props: Record<string, unknown>) => { mockApprovedProps = props; return null; } }));

describe("onboarding OAuth routing", () => {
  beforeEach(() => { mockReplace.mockClear(); mockPush.mockClear(); mockOpenUrl.mockClear(); mockRestore.mockReset().mockResolvedValue(true); mockStartOAuth.mockReset().mockResolvedValue(undefined); mockApprovedProps = null; mockAuthPhase = "authenticated"; mockOnboardingStatus = "profile_sync_required"; mockStep = "create-account"; });

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
});
