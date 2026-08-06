import { render, waitFor } from "@testing-library/react-native";
import AuthCallbackRoute from "@/app/(auth)/auth/callback";

const mockReplace = jest.fn();
const mockCompleteOAuthCode = jest.fn();
let mockSearchParams: { code?: string; error?: string; error_description?: string } = {};
let mockAuth: { phase: string; error: string | null; signingIn: string | null; completeOAuthCode: (code: string) => Promise<boolean> } = {
  phase: "authenticated",
  error: null,
  signingIn: null,
  completeOAuthCode: mockCompleteOAuthCode,
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@/features/auth/auth-provider", () => ({ useAuth: () => mockAuth }));
jest.mock("@/screens/auth", () => ({ AuthLoadingScreen: () => null }));

describe("AuthCallbackRoute", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockCompleteOAuthCode.mockReset().mockResolvedValue(true);
    mockSearchParams = {};
    mockAuth = { phase: "authenticated", error: null, signingIn: null, completeOAuthCode: mockCompleteOAuthCode };
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
    render(<AuthCallbackRoute />);
    await waitFor(() => expect(mockCompleteOAuthCode).toHaveBeenCalledWith("routed-pkce-code"));
  });
});
