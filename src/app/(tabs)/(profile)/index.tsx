import { useEffect } from "react";
import { Linking } from "react-native";
import { type Href, useRouter } from "expo-router";

import { ProfileScreen } from "@/screens/profile";
import { useAuth } from "@/features/auth/auth-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { useCapturePreferences } from "@/features/capture/capture-preferences";
import { useProfile } from "@/features/profile/profile-provider";

export default function ProfileRoute() {
  const auth = useAuth();
  const router = useRouter();
  const profileState = useProfile();
  const capture = useCapturePreferences((state) => state.preferences);
  const hydrateCapture = useCapturePreferences((state) => state.hydrate);
  const updateCapture = useCapturePreferences((state) => state.update);
  const legal = (() => {
    try {
      return getLegalLinks();
    } catch {
      return null;
    }
  })();
  useEffect(() => {
    void hydrateCapture();
  }, [hydrateCapture]);
  return (
    <ProfileScreen
      displayName={profileState.profile?.displayName ?? "Formie Athlete"}
      email={auth.email ?? "Verified account"}
      videoRetentionDays={profileState.profile?.videoRetentionDays ?? null}
      capturePreferences={capture}
      onSaveProfile={async (nextProfile) => {
        await profileState.saveProfile(nextProfile);
      }}
      onSaveCapturePreferences={updateCapture}
      onSetRetention={async (days) => {
        await profileState.saveProfile({
          videoRetentionDays: days,
          retentionEffectiveAt: days === 30 ? new Date().toISOString() : null,
        });
      }}
      onChangeEmail={() => router.push("/account/change-email" as Href)}
      onChangePassword={() => router.push("/account/change-password" as Href)}
      onSendFeedback={() => router.push("/account/send-feedback" as Href)}
      termsUrl={legal?.termsUrl}
      privacyUrl={legal?.privacyUrl}
      onOpenUrl={async (url) => {
        await Linking.openURL(url);
      }}
      onLogOut={auth.logOut}
    />
  );
}
