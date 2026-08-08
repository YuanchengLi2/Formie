import { act, render, waitFor } from "@testing-library/react-native";
import AuthCallbackRoute from "@/app/(auth)/auth/callback";

const mockReplace = jest.fn();
const mockCompleteOAuthCode = jest.fn();
const mockMarkAuthenticated = jest.fn();
let mockSearchParams: { code?: string; error?: string; error_description?: string } = {};
let mockAuth: { phase: string; user?: { id: string } | null; error: string | null; signingIn: string | null; completeOAuthCode: (code: string) => Promise<boolean> } = {
  phase: "authenticated",
  error: null,
  signingIn: null,
  completeOAuthCode: mockCompleteOAuthCode,
};
let mockOnboarding = { status: "collecting", oauthIntent: null as "create_account" | "login" | null, markAuthenticated: mockMarkAuthenticated };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => mockAuth }));
jest.mock("@/features/onboarding/onboarding-store", () => ({ useOnboarding: () => mockOnboarding }));
jest.mock("@/screens/auth", () => ({ AuthLoadingScreen: () => null }));

describe("AuthCallbackRoute", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockCompleteOAuthCode.mockReset().mockResolvedValue(true);
    mockMarkAuthenticated.mockReset().mockResolvedValue(undefined);
    mockSearchParams = {};
    mockAuth = { phase: "authenticated", error: null, signingIn: null, completeOAuthCode: mockCompleteOAuthCode };
    mockOnboarding = { status: "collecting", oauthIntent: null, markAuthenticated: mockMarkAuthenticated };
  });

  it("leaves the callback spinner after OAuth creates a session", async () => {
    render(<AuthCallbackRoute />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });

  it("returns to login when the callback finishes without a session", async () => {
    mockAuth = { phase: "signed_out", error: "Provider rejected the callback", signingIn: null, completeOAuthCode: mockCompleteOAuthCode };
    render(<AuthCallbackRoute />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expect.stringMatching(/^\/login\?error=.*Provider/)));
  });

  it("hands a routed PKCE code to the auth provider", async () => {
    mockSearchParams = { code: "routed-pkce-code" };
    mockAuth = { phase: "signed_out", error: null, signingIn: "google", completeOAuthCode: mockCompleteOAuthCode };
    await act(async () => { render(<AuthCallbackRoute />); await Promise.resolve(); });
    await waitFor(() => expect(mockCompleteOAuthCode).toHaveBeenCalledWith("routed-pkce-code"));
  });

  it("attaches the completed onboarding draft before leaving an authenticated create-account callback", async () => {
    mockSearchParams = { code: "create-account-code" };
    mockAuth = { phase: "authenticated", user: { id: "user-1" }, error: null, signingIn: null, completeOAuthCode: mockCompleteOAuthCode };
    mockOnboarding = { status: "account_required", oauthIntent: "create_account", markAuthenticated: mockMarkAuthenticated };

    await act(async () => { render(<AuthCallbackRoute />); await Promise.resolve(); });

    await waitFor(() => expect(mockMarkAuthenticated).toHaveBeenCalledWith("user-1"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding/create-account"));
  });

  it("does not leave the callback route while the PKCE exchange is still running", async () => {
    let finishExchange: ((value: boolean) => void) | null = null;
    mockCompleteOAuthCode.mockReturnValue(new Promise<boolean>((resolve) => { finishExchange = resolve; }));
    mockSearchParams = { code: "slow-pkce-code" };
    mockAuth = { phase: "signed_out", error: null, signingIn: null, completeOAuthCode: mockCompleteOAuthCode };

    render(<AuthCallbackRoute />);
    await waitFor(() => expect(mockCompleteOAuthCode).toHaveBeenCalledWith("slow-pkce-code"));
    expect(mockReplace).not.toHaveBeenCalled();

    mockAuth = { ...mockAuth, error: "Provider rejected the callback" };
    await act(async () => { finishExchange?.(true); await Promise.resolve(); });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(expect.stringMatching(/^\/login\?error=/)));
  });
});
