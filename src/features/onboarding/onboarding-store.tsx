import * as SecureStore from "expo-secure-store";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

import { useAuth } from "@/features/auth/auth-provider";

import { parseOnboardingState } from "./onboarding-schema";
import {
  initialOnboardingAnswers,
  initialOnboardingState,
  loggedOutOnboardingState,
  onboardingNeedsIntro,
  reduceOnboardingState,
  resolveOnboardingStateForUser,
  type OAuthIntent,
  type OnboardingAction,
  type OnboardingAnswers,
  type OnboardingState,
  type OnboardingStep,
} from "./types";

const STORAGE_KEY = "formie.onboarding.v2";
const LEGACY_STORAGE_KEY = "formie.onboarding.v1";
const memoryStorage = new Map<string, string>();

export function isDeviceLogoutReason(reason: string | null | undefined): boolean {
  return reason === "invalid_session";
}

function storageKey(userId: string | null, base = STORAGE_KEY): string {
  return userId ? `${base}:${userId}` : base;
}

async function getStoredValue(userId: string | null, base = STORAGE_KEY): Promise<string | null> {
  const key = storageKey(userId, base);
  if (process.env.EXPO_OS === "web") {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    return memoryStorage.get(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function setStoredValue(value: string, userId: string | null): Promise<void> {
  const key = storageKey(userId);
  if (process.env.EXPO_OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    else memoryStorage.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

function cloneInitialState(): OnboardingState {
  return { ...initialOnboardingState, answers: { ...initialOnboardingAnswers } };
}

export async function loadOnboardingState(userId: string | null = null): Promise<OnboardingState> {
  try {
    const raw = await getStoredValue(userId);
    if (raw) return parseOnboardingState(JSON.parse(raw)) ?? cloneInitialState();

    if (!userId) {
      const legacyRaw = await getStoredValue(null, LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as { explicitLogoutAt?: unknown };
        if (typeof legacy.explicitLogoutAt === "string") return loggedOutOnboardingState(legacy.explicitLogoutAt);
      }
    }
  } catch {
    return cloneInitialState();
  }
  return cloneInitialState();
}

export async function persistOnboardingState(state: OnboardingState): Promise<void> {
  await setStoredValue(JSON.stringify(state), state.ownerUserId);
}

type OnboardingContextValue = OnboardingState & {
  hydrated: boolean;
  needsIntro: boolean;
  dispatch: (action: OnboardingAction) => Promise<void>;
  updateAnswer: <Field extends keyof OnboardingAnswers>(field: Field, value: OnboardingAnswers[Field]) => Promise<void>;
  setStep: (step: OnboardingStep) => Promise<void>;
  requireAccount: () => Promise<void>;
  startOAuth: (intent: OAuthIntent) => Promise<void>;
  markAuthenticated: (userId: string) => Promise<void>;
  markProfileSynced: () => Promise<void>;
  completeAccess: () => Promise<void>;
  startNewAccount: () => Promise<void>;
  markLoggedOut: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const [state, setState] = useState<OnboardingState>(cloneInitialState);
  const stateRef = useRef(state);
  const userIdRef = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    const userId = auth.phase === "authenticated" ? auth.user?.id ?? null : null;
    userIdRef.current = userId;
    void (async () => {
      if (!userId && isDeviceLogoutReason(auth.sessionExitReason)) {
        const exited = loggedOutOnboardingState();
        await setStoredValue(JSON.stringify(exited), null).catch(() => undefined);
        if (!active) return;
        stateRef.current = exited;
        setState(exited);
        setHydrated(true);
        return;
      }
      const signedOutState = await loadOnboardingState(null);
      const scopedState = userId ? await loadOnboardingState(userId) : null;
      const loaded = userId
        ? resolveOnboardingStateForUser(scopedState?.ownerUserId === userId ? scopedState : null, signedOutState, userId)
        : signedOutState;
      if (!active) return;
      stateRef.current = loaded;
      setState(loaded);
      setHydrated(true);
      if (userId && loaded.ownerUserId === userId) {
        await setStoredValue(JSON.stringify(loaded), userId).catch(() => undefined);
      }
    })().catch(() => {
      if (!active) return;
      const fallback = cloneInitialState();
      stateRef.current = fallback;
      setState(fallback);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [auth.phase, auth.sessionExitReason, auth.user?.id]);

  const dispatch = useCallback(async (action: OnboardingAction) => {
    const reduced = reduceOnboardingState(stateRef.current, action);
    const userId = userIdRef.current;
    const next = userId && action.type !== "new_account_started"
      ? { ...reduced, ownerUserId: userId }
      : reduced;
    stateRef.current = next;
    setState(next);
    try {
      await setStoredValue(JSON.stringify(next), next.ownerUserId);
      if (!next.ownerUserId) await setStoredValue(JSON.stringify(next), null);
    } catch {
      // The in-memory flow remains usable; the screen can still report a later server failure.
    }
  }, []);

  const updateAnswer = useCallback(<Field extends keyof OnboardingAnswers>(field: Field, value: OnboardingAnswers[Field]) => (
    dispatch({ type: "answer_changed", field, value })
  ), [dispatch]);
  const setStep = useCallback((step: OnboardingStep) => dispatch({ type: "step_viewed", step }), [dispatch]);
  const requireAccount = useCallback(() => dispatch({ type: "account_required" }), [dispatch]);
  const startOAuth = useCallback((intent: OAuthIntent) => dispatch({ type: "oauth_started", intent }), [dispatch]);
  const markAuthenticated = useCallback((userId: string) => dispatch({ type: "auth_succeeded", userId }), [dispatch]);
  const markProfileSynced = useCallback(() => dispatch({ type: "profile_sync_succeeded" }), [dispatch]);
  const completeAccess = useCallback(() => dispatch({ type: "access_granted", userId: userIdRef.current }), [dispatch]);
  const startNewAccount = useCallback(() => dispatch({ type: "new_account_started" }), [dispatch]);
  const markLoggedOut = useCallback(async () => {
    const next = loggedOutOnboardingState();
    stateRef.current = next;
    setState(next);
    await setStoredValue(JSON.stringify(next), null).catch(() => undefined);
  }, []);

  const value = useMemo<OnboardingContextValue>(() => ({
    ...state,
    hydrated,
    needsIntro: onboardingNeedsIntro(state),
    dispatch,
    updateAnswer,
    setStep,
    requireAccount,
    startOAuth,
    markAuthenticated,
    markProfileSynced,
    completeAccess,
    startNewAccount,
    markLoggedOut,
  }), [completeAccess, dispatch, hydrated, markAuthenticated, markLoggedOut, markProfileSynced, requireAccount, setStep, startNewAccount, startOAuth, state, updateAnswer]);

  return <OnboardingContext value={value}>{children}</OnboardingContext>;
}

export function useOnboarding(): OnboardingContextValue {
  const value = use(OnboardingContext);
  if (!value) throw new Error("useOnboarding must be used inside OnboardingProvider");
  return value;
}
