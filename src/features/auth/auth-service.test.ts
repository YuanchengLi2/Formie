import { createAuthService } from "./auth-service";

function authClient() {
  return {
    signInWithOAuth: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOtp: jest.fn(),
    verifyOtp: jest.fn(),
    signOut: jest.fn(),
  };
}

describe("social auth service", () => {
  const redirectUrl = "form://auth/callback";

  it.each(["apple", "google"] as const)("starts %s PKCE OAuth without a password", async (provider) => {
    const client = authClient();
    client.signInWithOAuth.mockResolvedValue({ data: { url: `https://${provider}.example/login` }, error: null });

    await expect(createAuthService(client, redirectUrl).createOAuthUrl(provider)).resolves.toBe(`https://${provider}.example/login`);
    expect(client.signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
  });

  it("rejects unsupported identity providers before calling Supabase", async () => {
    const client = authClient();
    await expect(createAuthService(client, redirectUrl).createOAuthUrl("github" as never)).rejects.toThrow("Apple and Google");
    expect(client.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("exchanges only an OAuth authorization code for a session", async () => {
    const client = authClient();
    const session = { user: { id: "user-1" } };
    client.exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    await expect(createAuthService(client, redirectUrl).completeOAuth("pkce-code")).resolves.toBe(session);
    expect(client.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
  });

  it("rejects an exchange response without an authenticated user", async () => {
    const client = authClient();
    client.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(createAuthService(client, redirectUrl).completeOAuth("empty-code")).rejects.toThrow(/authenticated session/i);
  });

  it("logs out the local device session", async () => {
    const client = authClient();
    client.signOut.mockResolvedValue({ data: {}, error: null });
    await createAuthService(client, redirectUrl).logOut();
    expect(client.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("sends one email code for both existing and new accounts", async () => {
    const client = authClient();
    client.signInWithOtp.mockResolvedValue({ data: {}, error: null });

    await createAuthService(client, redirectUrl).sendEmailCode(" Athlete@Example.com ");

    expect(client.signInWithOtp).toHaveBeenCalledWith({
      email: "athlete@example.com",
      options: { shouldCreateUser: true },
    });
  });

  it("verifies a six digit email code and returns its session directly", async () => {
    const client = authClient();
    const session = { user: { id: "email-user", email: "athlete@example.com" } };
    client.verifyOtp.mockResolvedValue({ data: { session }, error: null });

    await expect(createAuthService(client, redirectUrl).verifyEmailCode("Athlete@Example.com", " 123456 ")).resolves.toBe(session);
    expect(client.verifyOtp).toHaveBeenCalledWith({ email: "athlete@example.com", token: "123456", type: "email" });
  });

  it("rejects an email verification response without an authenticated user", async () => {
    const client = authClient();
    client.verifyOtp.mockResolvedValue({ data: { session: null }, error: null });
    await expect(createAuthService(client, redirectUrl).verifyEmailCode("athlete@example.com", "123456")).rejects.toThrow(/authenticated session/i);
  });

  it("signs an existing account in with normalized email and password", async () => {
    const client = authClient();
    const session = { user: { id: "review-user", email: "appreview@formie.app" } };
    client.signInWithPassword.mockResolvedValue({ data: { session }, error: null });

    await expect(createAuthService(client, redirectUrl).signInWithPassword(" AppReview@Formie.app ", "review-password")).resolves.toBe(session);
    expect(client.signInWithPassword).toHaveBeenCalledWith({
      email: "appreview@formie.app",
      password: "review-password",
    });
  });

  it("rejects a password response without an authenticated user", async () => {
    const client = authClient();
    client.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null });

    await expect(createAuthService(client, redirectUrl).signInWithPassword("appreview@formie.app", "review-password")).rejects.toThrow(/authenticated session/i);
  });
});
