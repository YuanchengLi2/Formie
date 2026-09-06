/* eslint-disable import/first */
import { AppState, Pressable, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockGetInitialURL = jest.fn();
const mockAddEventListener = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockSignInWithIdToken = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignOut = jest.fn();
const mockUpdateUser = jest.fn();
const mockInvoke = jest.fn();
const mockLoadProfile = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
const mockAppleSignInAsync = jest.fn();
const mockDigestStringAsync = jest.fn();
const mockGetRandomBytes = jest.fn();
let authStateChangeCallback: ((event: string, session: { user: { id: string; is_anonymous: boolean } } | null) => void) | null = null;

jest.mock("@/lib/supabase", () => ({
  supabase: { auth: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    getUser: (...args: unknown[]) => mockGetUser(...args),
    onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    signInWithIdToken: (...args: unknown[]) => mockSignInWithIdToken(...args),
    exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
    signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
    signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
    verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    updateUser: (...args: unknown[]) => mockUpdateUser(...args),
  }, functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: (...args: unknown[]) => mockAppleSignInAsync(...args),
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: (...args: unknown[]) => mockDigestStringAsync(...args),
  getRandomBytes: (...args: unknown[]) => mockGetRandomBytes(...args),
}));

jest.mock("expo-linking", () => ({
  createURL: () => "form://auth/callback",
  getInitialURL: (...args: unknown[]) => mockGetInitialURL(...args),
  addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

jest.mock("@/lib/query-client", () => ({ queryClient: { clear: jest.fn() } }));

jest.mock("@/features/profile/profile-repository", () => ({
  loadUserProfile: (...args: unknown[]) => mockLoadProfile(...args),
}));

import { AuthProvider, useAuth } from "./auth-provider";

function Probe() {
  const auth = useAuth();
  return <>
    <Text>{auth.phase}</Text>
    <Text>{auth.user?.id ?? "no-user"}</Text>
    <Text>{auth.error ?? "no-error"}</Text>
    <Text>{auth.signingIn ?? "not-signing-in"}</Text>
    <Pressable accessibilityRole="button" onPress={() => void auth.signInWithApple("login")}><Text>Apple</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => void auth.signInWithApple("create_account")}><Text>Create with Apple</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => void auth.signInWithProvider("google")}><Text>Google</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => void auth.signInWithPassword(" AppReview@Formie.app ", "review-password")}><Text>Password sign in</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => void auth.sendEmailCode("athlete@example.com", "login")}><Text>Send email code</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => void auth.verifyEmailCode("athlete@example.com", "123456")}><Text>Verify email code</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => void auth.logOut()}><Text>Log out</Text></Pressable>
  </>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
    authStateChangeCallback = null;
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockGetInitialURL.mockResolvedValue(null);
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateChangeCallback = callback;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    mockSignInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.test" }, error: null });
    mockSignInWithIdToken.mockResolvedValue({ data: { session: { access_token: "apple-access-token", user: { id: "apple-user", is_anonymous: false } } }, error: null });
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: "user-1", is_anonymous: false } } }, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: { session: { user: { id: "review-user", email: "appreview@formie.app" } } }, error: null });
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });
    mockVerifyOtp.mockResolvedValue({ data: { session: { user: { id: "email-user", email: "athlete@example.com" } } }, error: null });
    mockSignOut.mockResolvedValue({ data: {}, error: null });
    mockUpdateUser.mockResolvedValue({ data: { user: { id: "apple-user" } }, error: null });
    mockInvoke.mockResolvedValue({ data: { stored: true }, error: null });
    mockLoadProfile.mockResolvedValue({ userId: "apple-user", onboardingCompleted: true });
    mockGetRandomBytes.mockReturnValue(Uint8Array.from([1, 2, 3]));
    mockDigestStringAsync.mockResolvedValue("hashed-nonce");
    mockAppleSignInAsync.mockResolvedValue({ identityToken: "identity-token", authorizationCode: "authorization-code", fullName: { givenName: "Formie", familyName: "Reviewer" } });
  });

  it("completes native Apple sign-in only after the revocation token is stored", async () => {
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText("Apple")));

    expect(mockSignInWithIdToken).toHaveBeenCalledWith(expect.objectContaining({ provider: "apple", token: "identity-token" }));
    expect(mockInvoke).toHaveBeenCalledWith("apple-authorization", { method: "POST", body: { authorizationCode: "authorization-code" } });
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: "Formie Reviewer" } });
    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it("preserves a missing-profile Apple account so onboarding can be completed", async () => {
    mockLoadProfile.mockResolvedValue(null);
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText("Apple")));

    expect(screen.getByText("authenticated")).toBeTruthy();
    expect(screen.getByText("no-error")).toBeTruthy();
  });

  it("keeps a missing-profile Apple session for explicit account creation", async () => {
    mockLoadProfile.mockResolvedValue(null);
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText("Create with Apple")));

    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it("resumes an existing incomplete Apple account without deleting or recreating it", async () => {
    mockLoadProfile.mockResolvedValue({ userId: "apple-user", onboardingCompleted: false });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText("Apple")));

    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it("keeps profile read failures retryable without deleting the authenticated account", async () => {
    mockLoadProfile.mockRejectedValueOnce(new Error("database unavailable"));
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText("Apple")));

    expect(screen.getByText("database unavailable")).toBeTruthy();
    expect(screen.getByText("signed_out")).toBeTruthy();
  });

  it("does not publish Apple's provisional Supabase session before authorization custody succeeds", async () => {
    const appleSession = { user: { id: "apple-user", is_anonymous: false } };
    let releaseCustody: ((value: { data: { stored: true }; error: null }) => void) | null = null;
    mockSignInWithIdToken.mockImplementation(async () => {
      authStateChangeCallback?.("SIGNED_IN", appleSession);
      return { data: { session: appleSession }, error: null };
    });
    mockInvoke.mockImplementation(() => new Promise((resolve) => {
      releaseCustody = resolve;
    }));
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    fireEvent.press(screen.getByText("Apple"));
    expect(await screen.findByText("apple")).toBeTruthy();
    expect(screen.getByText("signed_out")).toBeTruthy();
    expect(screen.queryByText("authenticated")).toBeNull();

    await act(async () => releaseCustody?.({ data: { stored: true }, error: null }));
    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it("keeps a cancelled Apple sheet signed out and shows a retryable message", async () => {
    mockAppleSignInAsync.mockRejectedValue(Object.assign(new Error("cancelled"), { code: "ERR_REQUEST_CANCELED" }));
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText("Apple")));

    expect(screen.getByText("Apple sign-in was closed before it finished. Please try again.")).toBeTruthy();
    expect(screen.getByText("signed_out")).toBeTruthy();
    expect(mockSignInWithIdToken).not.toHaveBeenCalled();
  });

  it("recovers a missing native identity token through the nonce-bound server exchange", async () => {
    mockAppleSignInAsync.mockResolvedValue({ identityToken: null, authorizationCode: "authorization-code", fullName: null });
    mockInvoke
      .mockResolvedValueOnce({ data: { identityToken: "server-identity-token", authorizationReceipt: "opaque-receipt" }, error: null })
      .mockResolvedValueOnce({ data: { stored: true }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText("Apple")));

    expect(mockInvoke).toHaveBeenNthCalledWith(1, "apple-token-exchange", {
      method: "POST",
      body: { authorizationCode: "authorization-code", nonce: "hashed-nonce" },
    });
    expect(mockSignInWithIdToken).toHaveBeenCalledWith(expect.objectContaining({ provider: "apple", token: "server-identity-token" }));
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "apple-authorization", {
      method: "POST",
      body: { authorizationReceipt: "opaque-receipt" },
    });
    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it("shows an authorization-code exchange error distinctly and ends the new session", async () => {
    mockInvoke.mockResolvedValue({ data: { code: "APPLE_TOKEN_EXCHANGE_FAILED" }, error: new Error("Edge Function failed") });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => fireEvent.press(screen.getByText("Apple")));

    expect(screen.getByText("Apple's authorization code could not be exchanged. Please try again.")).toBeTruthy();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("restores a signed-out startup", async () => {
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
  });

  it("opens OAuth and exchanges the returned PKCE code", async () => {
    const session = { user: { id: "user-1", is_anonymous: false } };
    mockOpenAuthSessionAsync.mockResolvedValue({ type: "success", url: "form://auth/callback?code=pkce-code" });
    mockExchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Google")));
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith("https://accounts.google.test", "form://auth/callback");
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it("settles browser cancellation with a retryable message", async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({ type: "cancel" });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Google")));
    expect(screen.getByText("Google sign-in was closed before it finished. Please try again.")).toBeTruthy();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("uses the auth browser as the only normal callback consumer", async () => {
    const callbackUrl = "form://auth/callback?code=single-use-code";
    const session = { user: { id: "user-1", is_anonymous: false } };
    mockOpenAuthSessionAsync.mockResolvedValue({ type: "success", url: callbackUrl });
    mockExchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Google")));
    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(mockAddEventListener).not.toHaveBeenCalled();
    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it("recovers a cold-start callback exactly once", async () => {
    const session = { user: { id: "user-2", is_anonymous: false } };
    mockGetInitialURL.mockResolvedValue("form://auth/callback?code=cold-code");
    mockExchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("authenticated")).toBeTruthy();
    expect(mockExchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it("invalidates only a remotely confirmed deleted user", async () => {
    const session = { user: { id: "deleted-user", is_anonymous: false } };
    mockGetSession.mockResolvedValue({ data: { session }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { status: 401, code: "user_not_found", message: "User not found" } });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("retains a persisted session through transient validation failure", async () => {
    const session = { user: { id: "user-1", is_anonymous: false } };
    mockGetSession.mockResolvedValue({ data: { session }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { status: 503, message: "network unavailable" } });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("authenticated")).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("sends and verifies an email OTP, hydrating the returned session", async () => {
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Send email code")));
    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: "athlete@example.com", options: { shouldCreateUser: false } });
    await act(async () => fireEvent.press(screen.getByText("Verify email code")));
    expect(mockVerifyOtp).toHaveBeenCalledWith({ email: "athlete@example.com", token: "123456", type: "email" });
    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it.each([false, true])("ignores stale startup validation after a newer sign-in (invalid=%s)", async (invalid) => {
    let finish!: (value: unknown) => void;
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "old-user" } } }, error: null });
    mockGetUser.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await act(async () => { authStateChangeCallback?.("SIGNED_IN", { user: { id: "new-user", is_anonymous: false } }); });
    await act(async () => finish(invalid
      ? { data: { user: null }, error: { status: 401, code: "user_not_found" } }
      : { data: { user: { id: "old-user" } }, error: null }));
    expect(await screen.findByText("authenticated")).toBeTruthy();
    expect(screen.getByText("new-user")).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("does not resurrect a logged-out session when foreground validation completes", async () => {
    const listener = jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("authenticated")).toBeTruthy();
    let finish!: (value: unknown) => void;
    mockGetUser.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const foreground = listener.mock.calls.at(-1)![1];
    await act(async () => { foreground("active"); });
    await act(async () => fireEvent.press(screen.getByText("Log out")));
    await act(async () => finish({ data: { user: { id: "user-1" } }, error: null }));
    expect(screen.getByText("signed_out")).toBeTruthy();
    expect(screen.getByText("no-user")).toBeTruthy();
  });

  it("signs an existing password account in and hydrates its session", async () => {
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Password sign in")));
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: "appreview@formie.app", password: "review-password" });
    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it("does not expose Supabase credential details when password sign-in fails", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: "Invalid login credentials" } });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Password sign in")));
    expect(screen.getByText("The email or password is incorrect.")).toBeTruthy();
    expect(screen.queryByText("Invalid login credentials")).toBeNull();
  });

  it("surfaces a provider callback error instead of leaving Google unsettled", async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({ type: "success", url: "form://auth/callback?error=access_denied&error_description=Google%20sign-in%20was%20cancelled" });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText("Google")));
    expect(screen.getByText("Google sign-in was cancelled")).toBeTruthy();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });
});
