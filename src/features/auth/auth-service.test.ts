import { createAuthService } from "./auth-service";

function authClient() {
  return {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    updateUser: jest.fn(),
    resend: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    setSession: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    verifyOtp: jest.fn(),
    reauthenticate: jest.fn(),
    refreshSession: jest.fn(),
    signOut: jest.fn(),
  };
}

describe("auth service", () => {
  const redirectUrl = "form://auth/callback";

  it("logs in and creates a verification-required account", async () => {
    const client = authClient();
    client.signInWithPassword.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    client.signUp.mockResolvedValue({ data: { user: { id: "user-1" }, session: null }, error: null });
    const service = createAuthService(client, redirectUrl);

    await service.logIn("USER@EXAMPLE.COM", "password");
    expect(client.signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "password" });

    await service.signUp({
      displayName: "Yuan Cheng",
      email: "USER@EXAMPLE.COM",
      password: "password",
      legalAcceptedAt: "2026-07-23T22:45:00.000Z",
    });
    expect(client.signUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password",
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: "Yuan Cheng",
          legal_accepted_at: "2026-07-23T22:45:00.000Z",
        },
      },
    });
  });

  it("rejects Supabase's obfuscated duplicate-signup response", async () => {
    const client = authClient();
    client.signUp.mockResolvedValue({
      data: { user: { id: "obfuscated-user", identities: [] }, session: null },
      error: null,
    });

    await expect(createAuthService(client, redirectUrl).signUp({
      displayName: "Yuan Cheng",
      email: "user@example.com",
      password: "password",
      legalAcceptedAt: "2026-07-23T22:45:00.000Z",
    })).rejects.toThrow("User already registered");
  });

  it("resends the appropriate verification email and requests neutral recovery", async () => {
    const client = authClient();
    client.resend.mockResolvedValue({ data: {}, error: null });
    client.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const service = createAuthService(client, redirectUrl);

    await service.resendVerification("user@example.com", "signup");
    expect(client.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "user@example.com",
      options: { emailRedirectTo: redirectUrl },
    });

    await service.requestPasswordReset("user@example.com");
    expect(client.resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", { redirectTo: redirectUrl });
  });

  it("handles implicit, PKCE, and token-hash callbacks", async () => {
    const client = authClient();
    client.setSession.mockResolvedValue({ data: { session: {} }, error: null });
    client.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    client.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    const service = createAuthService(client, redirectUrl);

    await service.completeCallback({ kind: "session", accessToken: "access", refreshToken: "refresh", flow: "verification" });
    expect(client.setSession).toHaveBeenCalledWith({ access_token: "access", refresh_token: "refresh" });

    await service.completeCallback({ kind: "code", code: "pkce", flow: "recovery" });
    expect(client.exchangeCodeForSession).toHaveBeenCalledWith("pkce");

    await service.completeCallback({ kind: "otp", tokenHash: "hash", otpType: "email", flow: "verification" });
    expect(client.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash", type: "email" });
  });

  it("verifies an emailed signup or recovery code with its normalized email", async () => {
    const client = authClient();
    client.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    const service = createAuthService(client, redirectUrl);

    await service.verifyEmailOtp(" USER@Example.COM ", "123456", "signup");
    expect(client.verifyOtp).toHaveBeenNthCalledWith(1, {
      email: "user@example.com",
      token: "123456",
      type: "signup",
    });

    await service.verifyEmailOtp("user@example.com", "654321", "recovery");
    expect(client.verifyOtp).toHaveBeenNthCalledWith(2, {
      email: "user@example.com",
      token: "654321",
      type: "recovery",
    });
  });

  it("updates a recovered password, refreshes verification, and logs out", async () => {
    const client = authClient();
    client.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    client.refreshSession.mockResolvedValue({ data: { session: {} }, error: null });
    client.signOut.mockResolvedValue({ error: null });
    const service = createAuthService(client, redirectUrl);

    await service.updateRecoveredPassword("new-password");
    expect(client.updateUser).toHaveBeenCalledWith({ password: "new-password" });
    await service.refreshSession();
    expect(client.refreshSession).toHaveBeenCalled();
    await service.logOut();
    expect(client.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("changes email through an authenticated six-digit verification flow", async () => {
    const client = authClient();
    client.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    client.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    client.refreshSession.mockResolvedValue({ data: { session: {} }, error: null });
    const service = createAuthService(client, redirectUrl);

    await service.requestEmailChange(" NEW@Example.COM ");
    expect(client.updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: redirectUrl },
    );
    await service.verifyEmailChange("new@example.com", "123456");
    expect(client.verifyOtp).toHaveBeenCalledWith({
      email: "new@example.com",
      token: "123456",
      type: "email_change",
    });
    expect(client.refreshSession).toHaveBeenCalledTimes(1);
  });

  it("reauthenticates before changing a signed-in password and keeps the session", async () => {
    const client = authClient();
    client.reauthenticate.mockResolvedValue({ data: {}, error: null });
    client.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    client.refreshSession.mockResolvedValue({ data: { session: {} }, error: null });
    const service = createAuthService(client, redirectUrl);

    await service.requestPasswordChange();
    expect(client.reauthenticate).toHaveBeenCalledTimes(1);
    await service.updatePassword("new-password", "654321");
    expect(client.updateUser).toHaveBeenCalledWith({
      password: "new-password",
      nonce: "654321",
    });
    expect(client.refreshSession).toHaveBeenCalledTimes(1);
    expect(client.signOut).not.toHaveBeenCalled();
  });

  it("throws backend errors without returning partial success", async () => {
    const client = authClient();
    const failure = new Error("Invalid login credentials");
    client.signInWithPassword.mockResolvedValue({ data: { session: null }, error: failure });

    await expect(createAuthService(client, redirectUrl).logIn("user@example.com", "bad-password")).rejects.toBe(failure);
  });
});
