import { AppState } from "react-native";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Session, User } from "@supabase/supabase-js";

import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";

import { parseAuthCallbackUrl } from "./auth-callback";
import { createAuthService, type AuthClient, type SocialProvider } from "./auth-service";
import { authSnapshotFromSession, classifyRemoteUserValidationError, withRemoteValidationDeadline } from "./auth-session";
import { deriveAuthPhase, type AuthPhase } from "./auth-state";

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  phase: AuthPhase;
  session: Session | null;
  user: User | null;
  email: string | null;
  error: string | null;
  signingIn: SocialProvider | null;
  emailBusy: "sending" | "verifying" | null;
  signInWithProvider: (provider: SocialProvider) => Promise<boolean>;
  completeOAuthCode: (code: string) => Promise<boolean>;
  sendEmailCode: (email: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  logOut: (reason?: SessionExitReason) => Promise<void>;
  sessionExitReason: SessionExitReason | null;
  clearError: () => void;
};

export type SessionExitReason = "user" | "invalid_session";

const AuthContext = createContext<AuthContextValue | null>(null);

async function currentSession(): Promise<Session | null> {
  const result = await supabase.auth.getSession();
  if (result.error) throw result.error;
  return result.data.session;
}

function friendlyOAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/provider.*not enabled/i.test(message)) return "This sign-in option is not enabled yet.";
  if (/network|fetch/i.test(message)) return "Check your connection and try signing in again.";
  return message || "Sign in could not be completed. Try again.";
}

function friendlyEmailError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "";
  if (/expired|invalid.*(token|otp)|otp.*invalid/i.test(message)) return "That code is invalid or expired. Request a new code and try again.";
  if (/rate|too many|security purposes/i.test(message)) return "Please wait a moment before requesting another code.";
  if (/email.*invalid|invalid.*email/i.test(message)) return "Enter a valid email address.";
  if (/network|fetch/i.test(message)) return "Check your connection and try again.";
  return message || "Email sign-in could not be completed. Try again.";
}

export function AuthProvider({ children }: PropsWithChildren) {
  const redirectUrl = Linking.createURL("auth/callback");
  const service = useMemo(() => createAuthService(supabase.auth as unknown as AuthClient, redirectUrl), [redirectUrl]);
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState<SocialProvider | null>(null);
  const [emailBusy, setEmailBusy] = useState<"sending" | "verifying" | null>(null);
  const callbackTasksRef = useRef(new Map<string, Promise<boolean>>());
  const completedCodesRef = useRef(new Set<string>());
  const [sessionExitReason, setSessionExitReason] = useState<SessionExitReason | null>(null);

  const clearLocalSession = useCallback(async (reason: SessionExitReason) => {
    await service.logOut().catch(() => undefined);
    queryClient.clear();
    setSession(null);
    setError(null);
    setSessionExitReason(reason);
  }, [service]);

  const validatePersistedSession = useCallback(async (candidate: Session | null) => {
    if (!candidate) return candidate;
    try {
      const result = await withRemoteValidationDeadline(supabase.auth.getUser());
      if (result.error) throw result.error;
      if (!result.data.user?.id) throw { status: 401, code: "user_not_found", message: "User not found" };
      return candidate;
    } catch (failure) {
      if (classifyRemoteUserValidationError(failure) === "invalid_session") {
        await clearLocalSession("invalid_session");
        return null;
      }
      return candidate;
    }
  }, [clearLocalSession]);

  const processCallback = useCallback((url: string): Promise<boolean> => {
    const callback = parseAuthCallbackUrl(url);
    if (!callback) return Promise.resolve(false);
    const key = callback.kind === "code" ? callback.code : url;
    if (completedCodesRef.current.has(key)) return Promise.resolve(true);
    const existing = callbackTasksRef.current.get(key);
    if (existing) return existing;
    const task = (async () => {
      if (callback.kind === "error") {
        setError(callback.message);
        return true;
      }
      try {
        const returnedSession = await service.completeOAuth(callback.code) as Session;
        setSession(returnedSession);
        setSessionExitReason(null);
        setError(null);
        completedCodesRef.current.add(key);
      } catch (failure) {
        setError(friendlyOAuthError(failure));
      }
      return true;
    })().finally(() => callbackTasksRef.current.delete(key));
    callbackTasksRef.current.set(key, task);
    return task;
  }, [service]);

  const completeOAuthCode = useCallback((code: string) => (
    processCallback(`${redirectUrl}?code=${encodeURIComponent(code)}`)
  ), [processCallback, redirectUrl]);

  useEffect(() => {
    let active = true;
    const authSubscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    void (async () => {
      try {
        let loadedSession = await currentSession();
        if (authSnapshotFromSession(loadedSession)?.isAnonymous) {
          await service.logOut();
          loadedSession = null;
        }
        loadedSession = await validatePersistedSession(loadedSession);
        if (!active) return;
        setSession(loadedSession);
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await processCallback(initialUrl);
      } catch (failure) {
        if (active) setError(friendlyOAuthError(failure));
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => {
      active = false;
      authSubscription.data.subscription.unsubscribe();
    };
  }, [processCallback, service, validatePersistedSession]);

  useEffect(() => {
    if (!session) return;
    const listener = AppState.addEventListener("change", (next) => {
      if (next === "active") void validatePersistedSession(session).then((validated) => {
        if (validated) setSession(validated);
      });
    });
    return () => listener.remove();
  }, [session, validatePersistedSession]);

  const phase = deriveAuthPhase({ initializing, session: authSnapshotFromSession(session) });
  const value = useMemo<AuthContextValue>(() => ({
    phase,
    session,
    user: session?.user ?? null,
    email: session?.user.email ?? null,
    error,
    signingIn,
    emailBusy,
    sessionExitReason,
    completeOAuthCode,
    async signInWithProvider(provider) {
      if (signingIn) return false;
      setSigningIn(provider);
      setError(null);
      try {
        const url = await service.createOAuthUrl(provider);
        const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
        if (result.type !== "success") {
          setError(`${provider === "google" ? "Google" : "Apple"} sign-in was closed before it finished. Please try again.`);
          return false;
        }
        return processCallback(result.url);
      } catch (failure) {
        setError(friendlyOAuthError(failure));
        return false;
      } finally {
        setSigningIn(null);
      }
    },
    async sendEmailCode(email) {
      if (emailBusy || signingIn) return false;
      setEmailBusy("sending");
      setError(null);
      try {
        await service.sendEmailCode(email);
        return true;
      } catch (failure) {
        setError(friendlyEmailError(failure));
        return false;
      } finally {
        setEmailBusy(null);
      }
    },
    async verifyEmailCode(email, code) {
      if (emailBusy || signingIn) return false;
      setEmailBusy("verifying");
      setError(null);
      try {
        const returnedSession = await service.verifyEmailCode(email, code) as Session;
        setSession(returnedSession);
        setSessionExitReason(null);
        return true;
      } catch (failure) {
        setError(friendlyEmailError(failure));
        return false;
      } finally {
        setEmailBusy(null);
      }
    },
    async logOut(reason = "user") {
      await clearLocalSession(reason);
    },
    clearError: () => setError(null),
  }), [clearLocalSession, completeOAuthCode, emailBusy, error, phase, processCallback, redirectUrl, service, session, sessionExitReason, signingIn]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
