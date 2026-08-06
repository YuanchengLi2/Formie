import { render, waitFor } from "@testing-library/react-native";
import OnboardingStepRoute from "@/app/onboarding/[step]";

const mockReplace = jest.fn();
let mockOnboardingStatus = "profile_sync_required";
let mockStep = "create-account";

jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("expo-router", () => ({
  Redirect: () => null,
  useLocalSearchParams: () => ({ step: mockStep }),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => ({ phase: "authenticated", user: { id: "user-1" }, signingIn: null, error: null, signInWithProvider: jest.fn() }) }));
jest.mock("@/features/auth/legal-config", () => ({ getLegalLinks: () => ({ termsUrl: "https://example.com/terms", privacyUrl: "https://example.com/privacy" }) }));
jest.mock("@/features/billing/billing-provider", () => ({ useBilling: () => ({ state: "ready", offering: { packages: [{ identifier: "$rc_monthly" }] }, priceString: "$9.99", error: null, purchase: jest.fn(), restore: jest.fn() }) }));
jest.mock("@/features/onboarding/onboarding-store", () => ({ useOnboarding: () => ({
  status: mockOnboardingStatus,
  answers: { acceptedPrivacy: true },
  setStep: jest.fn(), updateAnswer: jest.fn(), startOAuth: jest.fn(), markLoggedOut: jest.fn(), completeAccess: jest.fn(), markAuthenticated: jest.fn(), requireAccount: jest.fn(),
}) }));
jest.mock("@/features/profile/profile-provider", () => ({ useProfile: () => ({ status: "idle", error: null, retry: jest.fn() }) }));
jest.mock("@/screens/onboarding", () => ({ ApprovedOnboardingScreen: () => null }));

describe("onboarding OAuth routing", () => {
  beforeEach(() => { mockReplace.mockClear(); mockOnboardingStatus = "profile_sync_required"; mockStep = "create-account"; });

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
});
