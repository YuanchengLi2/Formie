export type SocialProvider = "apple" | "google";

type AuthResult = {
  error: unknown;
  data?: { url?: string | null; session?: unknown };
};

export type AuthClient = {
  signInWithOAuth: (input: {
    provider: SocialProvider;
    options: { redirectTo: string; skipBrowserRedirect: true };
  }) => Promise<AuthResult>;
  signInWithIdToken: (input: {
    provider: "apple";
    token: string;
    nonce: string;
  }) => Promise<AuthResult>;
  exchangeCodeForSession: (code: string) => Promise<AuthResult>;
  signInWithPassword: (input: { email: string; password: string }) => Promise<AuthResult>;
  signInWithOtp: (input: { email: string; options: { shouldCreateUser: true } }) => Promise<AuthResult>;
  verifyOtp: (input: { email: string; token: string; type: "email" }) => Promise<AuthResult>;
  signOut: (options: { scope: "local" }) => Promise<AuthResult>;
};

async function requireSuccess<T extends AuthResult>(operation: Promise<T>): Promise<T> {
  const result = await operation;
  if (result.error) throw result.error;
  return result;
}

export function createAuthService(client: AuthClient, redirectUrl: string) {
  const authenticatedSession = (result: AuthResult) => {
    const session = result.data?.session as { user?: { id?: string } } | null | undefined;
    if (!session?.user?.id) throw new Error("The provider did not return an authenticated session.");
    return session;
  };
  return {
    async createOAuthUrl(provider: SocialProvider): Promise<string> {
      if (provider !== "apple" && provider !== "google") {
        throw new Error("Formie sign-in supports only Apple and Google.");
      }
      const result = await requireSuccess(client.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      }));
      const url = result.data?.url;
      if (!url) throw new Error("The sign-in provider did not return a login URL.");
      return url;
    },
    async completeOAuth(code: string) {
      const result = await requireSuccess(client.exchangeCodeForSession(code));
      return authenticatedSession(result);
    },
    async signInWithIdToken(identityToken: string, rawNonce: string) {
      const result = await requireSuccess(client.signInWithIdToken({
        provider: "apple",
        token: identityToken,
        nonce: rawNonce,
      }));
      return authenticatedSession(result);
    },
    async signInWithPassword(email: string, password: string) {
      const result = await requireSuccess(client.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      }));
      return authenticatedSession(result);
    },
    async sendEmailCode(email: string): Promise<void> {
      await requireSuccess(client.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      }));
    },
    async verifyEmailCode(email: string, token: string) {
      const result = await requireSuccess(client.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: "email",
      }));
      return authenticatedSession(result);
    },
    async logOut(): Promise<void> {
      await requireSuccess(client.signOut({ scope: "local" }));
    },
  };
}
