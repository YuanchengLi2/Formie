import { useEffect } from "react";
import { Linking } from "react-native";
import { type Href, useRouter } from "expo-router";

import { ProfileScreen } from "@/screens/profile";
import { useAuth } from "@/features/auth/auth-provider";
import { useBilling } from "@/features/billing/billing-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { useCapturePreferences } from "@/features/capture/capture-preferences";
import { useProfile } from "@/features/profile/profile-provider";

export default function ProfileRoute() {
  const auth = useAuth();
  const billing = useBilling();
  const onboarding = useOnboarding();
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
      capturePreferences={capture}
      onSaveProfile={async (nextProfile) => {
        await profileState.saveProfile(nextProfile);
      }}
      onSaveCapturePreferences={updateCapture}
      onSendFeedback={() => router.push("/account/send-feedback" as Href)}
      onManageSubscription={() => router.push("/subscription" as Href)}
      termsUrl={legal?.termsUrl}
      privacyUrl={legal?.privacyUrl}
      onOpenUrl={async (url) => {
        await Linking.openURL(url);
      }}
      onLogOut={async () => {
        await billing.logOut().catch(() => undefined);
        await onboarding.markLoggedOut();
        await auth.logOut("user");
      }}
    />
  );
}
