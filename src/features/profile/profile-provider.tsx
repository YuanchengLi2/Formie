import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";

import { useAuth } from "@/features/auth/auth-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query-client";
import { acceptAiProcessingConsent, type AiConsentClient } from "@/features/privacy/ai-consent";
import { aiConsentQueryKey } from "@/features/privacy/use-ai-consent";
import { useReferral } from "@/features/referrals/referral-provider";
import { trackProductEvent } from "@/features/analytics/product-analytics";
import { recordOnboardingAcquisition, type AcquisitionReportingClient } from "@/features/onboarding/acquisition-reporting";

import {
  loadUserProfile,
  saveUserProfile,
  finalizeOnboardingProfile,
  upsertOnboardingProfile,
  type OnboardingFinalizationClient,
  type UserProfileClient,
  type UserProfilePatch,
} from "./profile-repository";
import type { UserProfile } from "./types";

export type ProfileStatus = "idle" | "loading" | "ready" | "error";

type ProfileContextValue = {
  status: ProfileStatus;
  profile: UserProfile | null;
  error: string | null;
  saving: boolean;
  retry: () => void;
  saveProfile: (patch: UserProfilePatch) => Promise<UserProfile>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);
const profileClient = supabase as unknown as UserProfileClient;
const finalizationClient = supabase as unknown as OnboardingFinalizationClient;
const acquisitionClient = supabase as unknown as AcquisitionReportingClient;
const aiConsentClient = supabase as unknown as AiConsentClient;

function reportProfileFailure(operation: "load" | "setup", reason: unknown): void {
  const details = reason && typeof reason === "object"
    ? {
        name: "name" in reason ? String(reason.name) : undefined,
        message: "message" in reason ? String(reason.message) : undefined,
        code: "code" in reason ? String(reason.code) : undefined,
      }
    : { message: String(reason) };
  console.error(`[ProfileProvider] profile ${operation} failed`, details);
}

export function ProfileProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const referral = useReferral();
  const referralToken = referral.pending?.token ?? null;
  const referralMethod = referral.method;
  const clearReferral = referral.clear;
  const shouldSyncOnboarding = onboarding.status === "profile_sync_required" && onboarding.oauthIntent === "create_account";
  const authenticatedUserId = auth.phase === "authenticated" ? auth.user?.id ?? null : null;
  const onboardingReadyForUser = !authenticatedUserId || onboarding.ownerUserId === authenticatedUserId;
  const onboardingAnswers = onboarding.answers;
  const markProfileSynced = onboarding.markProfileSynced;
  const [status, setStatus] = useState<ProfileStatus>("idle");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (auth.phase !== "authenticated" || !auth.user) {
      setStatus("idle");
      setProfile(null);
      setError(null);
      return;
    }
    if (!onboardingReadyForUser) {
      setStatus("loading");
      setProfile(null);
      setError(null);
      return;
    }

    let active = true;
    setStatus("loading");
    setError(null);
    const authenticatedUser = auth.user;
    const answers = shouldSyncOnboarding ? onboardingAnswers : undefined;
    void (async () => {
      let nextProfile: UserProfile | null;
      try {
        nextProfile = await loadUserProfile(profileClient, authenticatedUser.id);
      } catch (reason) {
        reportProfileFailure("load", reason);
        if (!active) return;
        setProfile(null);
        setStatus("error");
        setError("Your profile could not be loaded. Try again.");
        return;
      }
      let acquisitionRecordedByFinalization = false;
      if (answers && !nextProfile?.onboardingCompleted) {
        try {
          if (referralToken) {
            const finalized = await finalizeOnboardingProfile(
              finalizationClient,
              authenticatedUser,
              answers,
              Platform.OS,
              { token: referralToken, method: referralMethod },
            );
            nextProfile = finalized.profile;
            acquisitionRecordedByFinalization = true;
            await clearReferral();
          } else {
            nextProfile = await upsertOnboardingProfile(profileClient, authenticatedUser, answers);
          }
        } catch (reason) {
          reportProfileFailure("setup", reason);
          if (!active) return;
          setProfile(null);
          setStatus("error");
          setError("Your account setup could not be completed. Try again.");
          return;
        }
      }
      if (!active) return;
      if (!nextProfile) {
        setProfile(null);
        // Authentication can outlive an interrupted onboarding transaction.
        // A successful empty read must reach onboarding, not a retry loop.
        setStatus("ready");
        return;
      }
      setProfile(nextProfile);
      if (answers && nextProfile.onboardingCompleted) {
        try {
          if (!acquisitionRecordedByFinalization) {
            await recordOnboardingAcquisition(acquisitionClient, answers, Platform.OS);
            if (referralToken) await clearReferral();
          }
          if (answers.acceptedAiProcessing) {
            const consent = await acceptAiProcessingConsent(aiConsentClient);
            queryClient.setQueryData(aiConsentQueryKey(authenticatedUser.id), consent);
            void queryClient.invalidateQueries({ queryKey: aiConsentQueryKey(authenticatedUser.id), refetchType: "active" });
          }
          // Product analytics is durable but must remain non-blocking. A local
          // storage failure must never roll a successfully finalized account
          // back into the onboarding error state.
          void trackProductEvent("account_created", { onboardingVersion: "approved-v1" })
            .catch((reason) => console.warn("[ProfileProvider] account analytics enqueue failed", reason));
        } catch {
          if (!active) return;
          setStatus("error");
          setError("Your account setup could not be completed. Try again.");
          return;
        }
      }
      if (!active) return;
      setStatus("ready");
      if (answers && nextProfile.onboardingCompleted) await markProfileSynced();
    })();
    return () => {
      active = false;
    };
  }, [auth.phase, auth.user, clearReferral, markProfileSynced, onboardingAnswers, onboardingReadyForUser, referralMethod, referralToken, revision, shouldSyncOnboarding]);

  const saveProfile = useCallback(async (patch: UserProfilePatch) => {
    if (!auth.user || auth.phase !== "authenticated") {
      throw new Error("Log in to save your profile.");
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveUserProfile(profileClient, auth.user.id, patch);
      setProfile(saved);
      setStatus("ready");
      return saved;
    } catch {
      setError("Your profile could not be saved. Try again.");
      throw new Error("Your profile could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }, [auth.phase, auth.user]);

  const value = useMemo<ProfileContextValue>(() => ({
    status,
    profile,
    error,
    saving,
    retry: () => setRevision((current) => current + 1),
    saveProfile,
  }), [error, profile, saveProfile, saving, status]);

  return <ProfileContext value={value}>{children}</ProfileContext>;
}

export function useProfile(): ProfileContextValue {
  const value = use(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside ProfileProvider");
  return value;
}
