import type { AuthCallback } from "./auth-callback";

type AuthResult = {
  error: unknown;
  data?: { user?: { identities?: unknown[] | null } | null };
};
export type AuthSignUpInput = {
  displayName: string;
  email: string;
  password: string;
  legalAcceptedAt: string;
};
export type AuthClient = {
  signInWithPassword: (input: { email: string; password: string }) => Promise<AuthResult>;
  signUp: (input: {
    email: string;
    password: string;
    options: { emailRedirectTo: string; data: Record<string, unknown> };
  }) => Promise<AuthResult>;
  updateUser: (attributes: Record<string, unknown>, options?: { emailRedirectTo?: string }) => Promise<AuthResult>;
  resend: (input: { type: "signup" | "email_change"; email: string; options: { emailRedirectTo: string } }) => Promise<AuthResult>;
  resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<AuthResult>;
  setSession: (input: { access_token: string; refresh_token: string }) => Promise<AuthResult>;
  exchangeCodeForSession: (code: string) => Promise<AuthResult>;
  verifyOtp: (input:
    | { token_hash: string; type: "email" | "recovery" | "signup" | "email_change" }
    | { email: string; token: string; type: "recovery" | "signup" | "email_change" }
  ) => Promise<AuthResult>;
  reauthenticate: () => Promise<AuthResult>;
  refreshSession: () => Promise<AuthResult>;
  signOut: (options: { scope: "local" }) => Promise<AuthResult>;
};

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function requireSuccess<T extends AuthResult>(operation: Promise<T>): Promise<T> {
  const result = await operation;
  if (result.error) throw result.error;
  return result;
}

export function createAuthService(client: AuthClient, redirectUrl: string) {
  return {
    async logIn(email: string, password: string) {
      await requireSuccess(client.signInWithPassword({ email: normalizedEmail(email), password }));
    },
    async signUp(input: AuthSignUpInput) {
      const result = await requireSuccess(client.signUp({
        email: normalizedEmail(input.email),
        password: input.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: input.displayName,
            legal_accepted_at: input.legalAcceptedAt,
          },
        },
      }));
      if (result.data?.user && Array.isArray(result.data.user.identities) && result.data.user.identities.length === 0) {
        throw new Error("User already registered");
      }
    },
    async resendVerification(email: string, type: "signup" | "email_change") {
      await requireSuccess(client.resend({
        type,
        email: normalizedEmail(email),
        options: { emailRedirectTo: redirectUrl },
      }));
    },
    async requestPasswordReset(email: string) {
      await requireSuccess(client.resetPasswordForEmail(normalizedEmail(email), {
        redirectTo: redirectUrl,
      }));
    },
    async completeCallback(callback: AuthCallback) {
      if (callback.kind === "error") throw new Error(callback.message);
      if (callback.kind === "session") {
        await requireSuccess(client.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken }));
        return;
      }
      if (callback.kind === "code") {
        await requireSuccess(client.exchangeCodeForSession(callback.code));
        return;
      }
      await requireSuccess(client.verifyOtp({ token_hash: callback.tokenHash, type: callback.otpType }));
    },
    async verifyEmailOtp(
      email: string,
      token: string,
      type: "recovery" | "signup" | "email_change",
    ) {
      await requireSuccess(client.verifyOtp({
        email: normalizedEmail(email),
        token,
        type,
      }));
    },
    async updateRecoveredPassword(password: string) {
      await requireSuccess(client.updateUser({ password }));
    },
    async requestEmailChange(email: string) {
      await requireSuccess(client.updateUser(
        { email: normalizedEmail(email) },
        { emailRedirectTo: redirectUrl },
      ));
    },
    async verifyEmailChange(email: string, code: string) {
      await requireSuccess(client.verifyOtp({
        email: normalizedEmail(email),
        token: code,
        type: "email_change",
      }));
      await requireSuccess(client.refreshSession());
    },
    async requestPasswordChange() {
      await requireSuccess(client.reauthenticate());
    },
    async updatePassword(password: string, nonce: string) {
      await requireSuccess(client.updateUser({ password, nonce }));
      await requireSuccess(client.refreshSession());
    },
    async refreshSession() {
      await requireSuccess(client.refreshSession());
    },
    async logOut() {
      await requireSuccess(client.signOut({ scope: "local" }));
    },
  };
}
