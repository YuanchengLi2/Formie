import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";

import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";

import { parseAuthCallbackUrl } from "./auth-callback";
import {
  createAuthService,
  type AuthClient,
  type AuthSignUpInput,
} from "./auth-service";
import { authSnapshotFromSession } from "./auth-session";
import { deriveAuthPhase, type AuthPhase } from "./auth-state";
import {
  clearPendingVerification,
  loadPendingVerification,
  savePendingVerification,
  type PendingVerification,
} from "./pending-verification";

type AuthContextValue = {
  phase: AuthPhase;
  session: Session | null;
  user: User | null;
  email: string | null;
  verificationType: PendingVerification["type"] | null;
  callbackError: string | null;
  logIn: (email: string, password: string) => Promise<void>;
  signUp: (input: AuthSignUpInput) => Promise<void>;
  resendVerification: () => Promise<void>;
  verifyEmailOtp: (code: string) => Promise<void>;
  refreshVerification: () => Promise<void>;
  changeVerificationEmail: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updateRecoveredPassword: (password: string) => Promise<void>;
  requestEmailChange: (email: string) => Promise<void>;
  verifyEmailChange: (email: string, code: string) => Promise<void>;
  resendEmailChange: (email: string) => Promise<void>;
  requestPasswordChange: () => Promise<void>;
  updatePassword: (password: string, code: string) => Promise<void>;
  logOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function currentSession(): Promise<Session | null> {
  const result = await supabase.auth.getSession();
  if (result.error) throw result.error;
  return result.data.session;
}

function verifiedPermanentSession(session: Session | null): boolean {
  const snapshot = authSnapshotFromSession(session);
  return Boolean(snapshot && !snapshot.isAnonymous && snapshot.emailVerified);
}

function emailNotConfirmed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code).toLowerCase() : "";
  const message = "message" in error ? String(error.message).toLowerCase() : "";
  return code === "email_not_confirmed" || message.includes("email not confirmed");
}

export function AuthProvider({ children }: PropsWithChildren) {
  const redirectUrl = Linking.createURL("auth/callback");
  const service = useMemo(
    () => createAuthService(supabase.auth as unknown as AuthClient, redirectUrl),
    [redirectUrl],
  );
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  const processCallback = useCallback(async (url: string) => {
    const callback = parseAuthCallbackUrl(url);
    if (!callback) return false;
    if (callback.kind === "error") {
      setCallbackError(callback.message);
      return true;
    }
    try {
      await service.completeCallback(callback);
      const nextSession = await currentSession();
      setSession(nextSession);
      setRecoveryMode(callback.flow === "recovery");
      if (callback.flow === "verification" && verifiedPermanentSession(nextSession)) {
        await clearPendingVerification();
        setPendingVerification(null);
      }
    } catch {
      setCallbackError("This email link is invalid or has expired.");
    }
    return true;
  }, [service]);

  useEffect(() => {
    let active = true;
    const authSubscription = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      if (event === "SIGNED_OUT") setRecoveryMode(false);
    });
    const linkSubscription = Linking.addEventListener("url", ({ url }) => {
      void processCallback(url);
    });

    void (async () => {
      try {
        const [storedPending, loadedSession, initialUrl] = await Promise.all([
          loadPendingVerification(),
          currentSession(),
          Linking.getInitialURL(),
        ]);
        if (!active) return;
        let existingSession = loadedSession;
        let resumablePending = storedPending;
        if (authSnapshotFromSession(existingSession)?.isAnonymous) {
          await service.logOut();
          await clearPendingVerification();
          existingSession = null;
          resumablePending = null;
        }
        const snapshot = authSnapshotFromSession(existingSession);
        const pendingIsComplete = Boolean(
          snapshot
          && !snapshot.isAnonymous
          && snapshot.emailVerified
          && (!resumablePending || resumablePending.type === "signup"),
        );
        if (pendingIsComplete) {
          await clearPendingVerification();
          setPendingVerification(null);
        } else {
          setPendingVerification(resumablePending);
        }
        setSession(existingSession);
        if (initialUrl) await processCallback(initialUrl);
      } catch {
        if (active) setCallbackError("Formie could not restore your account. Try logging in again.");
      } finally {
        if (active) setInitializing(false);
      }
    })();

    return () => {
      active = false;
      authSubscription.data.subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, [processCallback, service]);

  const phase = deriveAuthPhase({
    initializing,
    session: authSnapshotFromSession(session),
    pendingVerificationEmail: pendingVerification?.email,
    recoveryMode,
  });

  const storePending = useCallback(async (value: PendingVerification) => {
    setPendingVerification(value);
    try {
      await savePendingVerification(value);
    } catch {
      // The Auth request already succeeded. Keep the in-memory verification
      // flow usable even if this device cannot persist its resume state.
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    phase,
    session,
    user: session?.user ?? null,
    email: session?.user.email ?? pendingVerification?.email ?? null,
    verificationType: pendingVerification?.type ?? null,
    callbackError,
    async logIn(email, password) {
      try {
        await service.logIn(email, password);
      } catch (error) {
        if (!emailNotConfirmed(error)) throw error;
        await storePending({ email: email.trim().toLowerCase(), type: "signup" });
        setCallbackError(null);
        try {
          await service.resendVerification(email, "signup");
        } catch {
          setCallbackError("Your email isn't verified. A new code could not be sent yet. Use Resend Code to try again.");
        }
        return;
      }
      const nextSession = await currentSession();
      if (!verifiedPermanentSession(nextSession)) throw new Error("Email not confirmed");
      await clearPendingVerification();
      setPendingVerification(null);
      setRecoveryMode(false);
      setSession(nextSession);
    },
    async signUp(input) {
      await service.signUp(input);
      await storePending({ email: input.email.trim().toLowerCase(), type: "signup" });
    },
    async resendVerification() {
      if (!pendingVerification) throw new Error("No email is waiting for verification");
      if (pendingVerification.type === "recovery") {
        await service.requestPasswordReset(pendingVerification.email);
        return;
      }
      await service.resendVerification(pendingVerification.email, pendingVerification.type);
    },
    async verifyEmailOtp(code) {
      if (!pendingVerification) throw new Error("No email is waiting for verification");
      const verification = pendingVerification;
      await service.verifyEmailOtp(verification.email, code, verification.type);
      const nextSession = await currentSession();
      if (!nextSession) throw new Error("Verification did not create a session");
      await clearPendingVerification();
      setPendingVerification(null);
      setRecoveryMode(verification.type === "recovery");
      setSession(nextSession);
    },
    async refreshVerification() {
      if (!session && pendingVerification?.type === "signup") {
        await clearPendingVerification();
        setPendingVerification(null);
        setCallbackError(null);
        return;
      }
      await service.refreshSession();
      const nextSession = await currentSession();
      setSession(nextSession);
      if (verifiedPermanentSession(nextSession)) {
        await clearPendingVerification();
        setPendingVerification(null);
      }
    },
    async changeVerificationEmail() {
      await clearPendingVerification();
      setPendingVerification(null);
      setCallbackError(null);
    },
    async requestPasswordReset(email) {
      await service.requestPasswordReset(email);
      if (!verifiedPermanentSession(session)) {
        await storePending({ email: email.trim().toLowerCase(), type: "recovery" });
      }
    },
    async updateRecoveredPassword(password) {
      await service.updateRecoveredPassword(password);
      try {
        await clearPendingVerification();
      } catch {
        // The credential update is authoritative. A local resume-state cleanup
        // failure must not turn a successful password change into a failure.
      }
      setPendingVerification(null);
      setRecoveryMode(false);
    },
    async requestEmailChange(email) {
      await service.requestEmailChange(email);
    },
    async verifyEmailChange(email, code) {
      await service.verifyEmailChange(email, code);
      setSession(await currentSession());
    },
    async resendEmailChange(email) {
      await service.resendVerification(email, "email_change");
    },
    async requestPasswordChange() {
      await service.requestPasswordChange();
    },
    async updatePassword(password, code) {
      await service.updatePassword(password, code);
    },
    async logOut() {
      await service.logOut();
      queryClient.clear();
      await clearPendingVerification();
      setPendingVerification(null);
      setRecoveryMode(false);
      setSession(null);
    },
    clearError() {
      setCallbackError(null);
    },
  }), [callbackError, pendingVerification, phase, service, session, storePending]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
