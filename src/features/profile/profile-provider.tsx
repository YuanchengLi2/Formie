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
import { recordOnboardingAcquisition, type AcquisitionReportingClient } from "@/features/onboarding/acquisition-reporting";

import {
  loadOrCreateUserProfile,
  saveUserProfile,
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
const acquisitionClient = supabase as unknown as AcquisitionReportingClient;

export function ProfileProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const shouldSyncOnboarding = onboarding.status === "profile_sync_required";
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

    let active = true;
    setStatus("loading");
    setError(null);
    const answers = shouldSyncOnboarding ? onboardingAnswers : undefined;
    void loadOrCreateUserProfile(profileClient, auth.user, answers)
      .then(async (nextProfile) => {
        if (!active) return;
        if (answers && nextProfile.onboardingCompleted) {
          await recordOnboardingAcquisition(acquisitionClient, answers, Platform.OS);
          void supabase.functions.invoke("sync-acquisition-sheet", { method: "POST" }).catch(() => undefined);
        }
        if (!active) return;
        setProfile(nextProfile);
        setStatus("ready");
        if (answers && nextProfile.onboardingCompleted) await markProfileSynced();
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setProfile(null);
        setStatus("error");
        setError("Your profile could not be loaded. Try again.");
      });
    return () => {
      active = false;
    };
  }, [auth.phase, auth.user, markProfileSynced, onboardingAnswers, revision, shouldSyncOnboarding]);

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
