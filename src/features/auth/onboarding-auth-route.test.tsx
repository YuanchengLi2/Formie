import { act, render, waitFor } from "@testing-library/react-native";
import OnboardingStepRoute from "@/app/onboarding/[step]";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockStartOAuth = jest.fn();
let mockOnboardingStatus = "profile_sync_required";
let mockStep = "create-account";
let mockAuthPhase = "authenticated";
let mockApprovedProps: Record<string, unknown> | null = null;

jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("expo-router", () => ({
  Redirect: () => null,
  useLocalSearchParams: () => ({ step: mockStep }),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => ({ phase: mockAuthPhase, user: mockAuthPhase === "authenticated" ? { id: "user-1" } : null, signingIn: null, error: null, signInWithProvider: jest.fn() }) }));
jest.mock("@/features/auth/legal-config", () => ({ getLegalLinks: () => ({ termsUrl: "https://example.com/terms", privacyUrl: "https://example.com/privacy" }) }));
jest.mock("@/features/billing/billing-provider", () => ({ useBilling: () => ({ state: "ready", offering: { packages: [{ identifier: "$rc_monthly" }] }, plans: { monthly: { identifier: "$rc_monthly", productIdentifier: "formie_monthly", priceString: "$9.99", title: "Formie Monthly" }, annual: null }, priceString: "$9.99", error: null, purchase: jest.fn(), restore: jest.fn() }) }));
jest.mock("@/features/onboarding/onboarding-store", () => ({ useOnboarding: () => ({
  status: mockOnboardingStatus,
  answers: { acceptedPrivacy: true },
  setStep: jest.fn(), updateAnswer: jest.fn(), startOAuth: mockStartOAuth, markLoggedOut: jest.fn(), completeAccess: jest.fn(), markAuthenticated: jest.fn(), requireAccount: jest.fn(),
}) }));
jest.mock("@/features/profile/profile-provider", () => ({ useProfile: () => ({ status: "idle", error: null, retry: jest.fn() }) }));
jest.mock("@/screens/onboarding", () => ({ ApprovedOnboardingScreen: (props: Record<string, unknown>) => { mockApprovedProps = props; return null; } }));

describe("onboarding OAuth routing", () => {
  beforeEach(() => { mockReplace.mockClear(); mockPush.mockClear(); mockStartOAuth.mockReset().mockResolvedValue(undefined); mockApprovedProps = null; mockAuthPhase = "authenticated"; mockOnboardingStatus = "profile_sync_required"; mockStep = "create-account"; });

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

  it("routes email onboarding to the email code entry screen", async () => {
    mockAuthPhase = "signed_out";
    mockOnboardingStatus = "account_required";
    render(<OnboardingStepRoute />);
    await waitFor(() => expect(mockApprovedProps).not.toBeNull());
    await act(async () => { (mockApprovedProps?.onEmail as (() => void))(); });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/email?intent=onboarding"));
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
});
