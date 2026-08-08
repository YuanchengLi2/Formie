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
import { useAccess } from "@/features/access/access-provider";
import { formatBillingTimestamp, formatSubscriptionStateLabel } from "@/features/access/account-access";
import { runSubscriptionTestControl, setSubscriptionTestRemaining } from "@/features/billing/subscription-test-controls";

export default function ProfileRoute() {
  const auth = useAuth();
  const billing = useBilling();
  const onboarding = useOnboarding();
  const router = useRouter();
  const profileState = useProfile();
  const access = useAccess();
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
      email={auth.user?.email ?? null}
      subscription={{
        plan: access.access.planCode === "annual" ? "Formie Annual" : "Formie Monthly",
        stateLabel: formatSubscriptionStateLabel(access.access),
        periodEndsLabel: access.access.sandbox && access.access.store === "test_store" && access.access.paidThrough
          ? `Test period ends ${formatBillingTimestamp(access.access.paidThrough)}`
          : null,
      }}
      capturePreferences={capture}
      onSaveProfile={async (nextProfile) => {
        await profileState.saveProfile(nextProfile);
      }}
      onSaveCapturePreferences={updateCapture}
      onSendFeedback={() => router.push("/account/send-feedback" as Href)}
      onManageSubscription={() => router.push("/subscription" as Href)}
      showTestControls={access.access.sandbox && access.access.store === "test_store"}
      testRemaining={access.access.remaining}
      onTestControl={async (action) => {
        await runSubscriptionTestControl(action);
        await access.refresh();
      }}
      onSetTestRemaining={async (remaining) => {
        await setSubscriptionTestRemaining(remaining);
        await access.refresh();
      }}
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
