/* eslint-disable import/first */
import { Pressable, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockGetInitialURL = jest.fn();
const mockAddEventListener = jest.fn();
const mockLoadPendingVerification = jest.fn();
const mockClearPendingVerification = jest.fn();
const mockSavePendingVerification = jest.fn();
const mockSetSession = jest.fn();
const mockRefreshSession = jest.fn();
const mockVerifyOtp = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockResend = jest.fn();
const mockSignOut = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
      exchangeCodeForSession: jest.fn(),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

jest.mock("expo-linking", () => ({
  createURL: () => "form://auth/callback",
  getInitialURL: (...args: unknown[]) => mockGetInitialURL(...args),
  addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
}));

jest.mock("./pending-verification", () => ({
  loadPendingVerification: (...args: unknown[]) => mockLoadPendingVerification(...args),
  savePendingVerification: (...args: unknown[]) => mockSavePendingVerification(...args),
  clearPendingVerification: (...args: unknown[]) => mockClearPendingVerification(...args),
}));

jest.mock("@/lib/query-client", () => ({ queryClient: { clear: jest.fn() } }));

import { AuthProvider, useAuth } from "./auth-provider";

function Probe() {
  const auth = useAuth();
  return (
    <>
      <Text>{auth.phase}</Text>
      <Text>{auth.email ?? "no-email"}</Text>
      <Text>{auth.verificationType ?? "no-verification"}</Text>
      <Text>{auth.callbackError ?? "no-error"}</Text>
      <Pressable accessibilityRole="button" onPress={() => auth.clearError()}><Text>Clear</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void auth.refreshVerification()}><Text>Continue after verification</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void auth.verifyEmailOtp("123456")}><Text>Verify email code</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void auth.requestPasswordReset("user@example.com")}><Text>Request reset code</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void auth.updateRecoveredPassword("new-password")}><Text>Complete password reset</Text></Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void auth.signUp({
          displayName: "Yuan Cheng",
          email: "user@example.com",
          password: "long-enough",
          legalAcceptedAt: "2026-07-24T04:20:00Z",
        })}
      >
        <Text>Sign up</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void auth.logIn("user@example.com", "long-enough")}>
        <Text>Log in</Text>
      </Pressable>
    </>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInitialURL.mockResolvedValue(null);
    mockLoadPendingVerification.mockResolvedValue(null);
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
    mockAddEventListener.mockReturnValue({ remove: jest.fn() });
    mockClearPendingVerification.mockResolvedValue(undefined);
    mockSavePendingVerification.mockResolvedValue(undefined);
    mockSetSession.mockResolvedValue({ data: { session: {} }, error: null });
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null });
    mockVerifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    mockSignUp.mockResolvedValue({ data: { user: { id: "user-1" }, session: null }, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: null });
    mockResend.mockResolvedValue({ data: {}, error: null });
    mockSignOut.mockResolvedValue({ data: {}, error: null });
    mockUpdateUser.mockResolvedValue({ data: { user: {} }, error: null });
  });

  it("resolves a signed-out startup without exposing app access", async () => {
    let resolveSession!: (value: { data: { session: null }; error: null }) => void;
    mockGetSession.mockReturnValue(new Promise((resolve) => {
      resolveSession = resolve;
    }));
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("initializing")).toBeTruthy();
    await act(async () => {
      resolveSession({ data: { session: null }, error: null });
    });
    expect(await screen.findByText("signed_out")).toBeTruthy();
  });

  it("clears a legacy anonymous session instead of showing a second signup flow", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { is_anonymous: true, email_confirmed_at: null, user_metadata: {} } } },
      error: null,
    });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("restores pending verification across relaunch", async () => {
    mockLoadPendingVerification.mockResolvedValue({ email: "user@example.com", type: "signup" });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("verification_pending")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("returns confirmation-only signups to login without refreshing a missing session", async () => {
    mockLoadPendingVerification.mockResolvedValue({ email: "user@example.com", type: "signup" });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("verification_pending")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Continue after verification"));
    });

    expect(await screen.findByText("signed_out")).toBeTruthy();
    expect(mockClearPendingVerification).toHaveBeenCalled();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it("verifies a signup code and releases the authenticated session", async () => {
    const verifiedSession = {
      user: {
        email: "user@example.com",
        is_anonymous: false,
        email_confirmed_at: "2026-07-24T04:20:00Z",
        user_metadata: {},
      },
    };
    mockLoadPendingVerification.mockResolvedValue({ email: "user@example.com", type: "signup" });
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: verifiedSession }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("verification_pending")).toBeTruthy();
    expect(screen.getByText("signup")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Verify email code"));
    });

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "signup",
    });
    expect(await screen.findByText("authenticated")).toBeTruthy();
    expect(mockClearPendingVerification).toHaveBeenCalled();
  });

  it("stores recovery email state and enters password recovery after its code", async () => {
    const recoverySession = {
      user: {
        email: "user@example.com",
        is_anonymous: false,
        email_confirmed_at: "2026-07-24T04:20:00Z",
        user_metadata: {},
      },
    };
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: recoverySession }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Request reset code"));
    });
    expect(mockSavePendingVerification).toHaveBeenCalledWith({
      email: "user@example.com",
      type: "recovery",
    });
    expect(await screen.findByText("recovery")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Verify email code"));
    });
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "recovery",
    });
    expect(await screen.findByText("password_recovery")).toBeTruthy();
  });

  it("keeps the verified recovery session after the password is updated", async () => {
    const recoverySession = {
      user: {
        email: "user@example.com",
        is_anonymous: false,
        email_confirmed_at: "2026-07-24T04:20:00Z",
        user_metadata: {},
      },
    };
    mockLoadPendingVerification.mockResolvedValue({ email: "user@example.com", type: "recovery" });
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: recoverySession }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("verification_pending")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Verify email code"));
    });
    expect(await screen.findByText("password_recovery")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Complete password reset"));
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(await screen.findByText("authenticated")).toBeTruthy();
  });

  it("emails a password reset from Settings without leaving an authenticated session", async () => {
    const verifiedSession = {
      user: {
        email: "user@example.com",
        is_anonymous: false,
        email_confirmed_at: "2026-07-24T04:20:00Z",
        user_metadata: {},
      },
    };
    mockGetSession.mockResolvedValue({ data: { session: verifiedSession }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("authenticated")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Request reset code"));
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalled();
    expect(mockSavePendingVerification).not.toHaveBeenCalled();
    expect(screen.getByText("authenticated")).toBeTruthy();
  });

  it("continues to code verification when local resume storage fails after signup", async () => {
    mockSavePendingVerification.mockRejectedValueOnce(new Error("SecureStore unavailable"));
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Sign up"));
    });

    expect(mockSignUp).toHaveBeenCalled();
    expect(await screen.findByText("verification_pending")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("resends the code and opens verification when login finds an unconfirmed email", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Log in"));
    });

    expect(mockResend).toHaveBeenCalledWith({
      type: "signup",
      email: "user@example.com",
      options: { emailRedirectTo: "form://auth/callback" },
    });
    expect(await screen.findByText("verification_pending")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("still opens verification when the automatic resend is rate limited", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { session: null },
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    mockResend.mockResolvedValueOnce({
      data: {},
      error: { code: "over_email_send_rate_limit", message: "Too many emails" },
    });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("signed_out")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText("Log in"));
    });

    expect(await screen.findByText("verification_pending")).toBeTruthy();
    expect(screen.getByText(/email isn't verified.*Resend Code/i)).toBeTruthy();
  });

  it("processes a cold-start recovery callback before releasing the gate", async () => {
    const verifiedSession = {
      user: {
        email: "user@example.com",
        is_anonymous: false,
        email_confirmed_at: "2026-07-23T12:00:00Z",
        user_metadata: {},
      },
    };
    mockGetInitialURL.mockResolvedValue("form://auth/callback#access_token=access&refresh_token=refresh&type=recovery");
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: verifiedSession }, error: null });

    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText("password_recovery")).toBeTruthy();
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: "access", refresh_token: "refresh" });
  });
});
