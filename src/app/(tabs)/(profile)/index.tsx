import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { type Href, useRouter } from "expo-router";

import { ProfileScreen } from "@/screens/profile";
import { useAuth } from "@/features/auth/auth-provider";
import { useBilling } from "@/features/billing/billing-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { useCapturePreferences } from "@/features/capture/capture-preferences";
import { useProfile } from "@/features/profile/profile-provider";
import { useAccess, useBillingSurfaceRefresh } from "@/features/access/access-provider";
import { createSubscriptionPresentation } from "@/features/billing/subscription-management-presentation";
import { runSubscriptionTestControl } from "@/features/billing/subscription-test-controls";
import { deleteAccount } from "@/features/account-deletion/api";
import { currentAiProcessingConsent, isCurrentAiProcessingConsent, revokeAiProcessingConsent, type AiConsentClient } from "@/features/privacy/ai-consent";
import { supabase } from "@/lib/supabase";

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
  const [aiConsent, setAiConsent] = useState<{ current: boolean; version: string | null } | null>(null);
  useBillingSurfaceRefresh();
  const subscriptionPresentation = createSubscriptionPresentation(access.access);
  const hasManagedSubscription = Boolean(access.access.store)
    && access.access.lifecycleState !== "not_subscribed"
    && access.access.lifecycleState !== "expired"
    && access.access.lifecycleState !== "unknown";
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
  useEffect(() => {
    let active = true;
    void currentAiProcessingConsent(supabase as unknown as AiConsentClient)
      .then((consent) => {
        if (active) setAiConsent({ current: isCurrentAiProcessingConsent(consent), version: consent?.version ?? null });
      })
      .catch(() => {
        if (active) setAiConsent({ current: false, version: null });
      });
    return () => { active = false; };
  }, [auth.user?.id]);
  return (
    <>
      <ProfileScreen
      displayName={profileState.profile?.displayName ?? "Formie Athlete"}
      email={auth.user?.email ?? null}
      subscription={{
        plan: access.access.planCode === "annual" ? "Formie Annual" : "Formie Monthly",
        stateLabel: `${subscriptionPresentation.badgeLabel} · Automatic renewal ${access.access.willRenew ? "on" : access.access.lifecycleState === "renewal_pending" ? "checking" : "off"}`,
        access: { lifecycleState: access.access.lifecycleState, willRenew: access.access.willRenew, paidThrough: access.access.paidThrough, sandbox: access.access.sandbox },
      }}
      onSubscriptionBoundary={() => void access.reconcile()}
      capturePreferences={capture}
      onSaveProfile={async (nextProfile) => {
        await profileState.saveProfile(nextProfile);
      }}
      onSaveCapturePreferences={updateCapture}
      onSendFeedback={() => router.push("/account/send-feedback" as Href)}
      onManageSubscription={() => {
        if (access.access.status === "expired") {
          router.push("/subscription" as Href);
          return;
        }
        router.push("/account/manage-subscription" as Href);
      }}
      showTestControls={access.access.sandbox && access.access.store === "test_store"}
      onTestControl={async (action) => {
        await runSubscriptionTestControl(action);
        await access.refresh();
      }}
      termsUrl={legal?.termsUrl}
      privacyUrl={legal?.privacyUrl}
      privacyChoicesUrl={legal?.privacyChoicesUrl}
      retentionUrl={legal?.retentionUrl}
      aiConsent={aiConsent}
      onWithdrawAiConsent={async () => {
        await revokeAiProcessingConsent(supabase as unknown as AiConsentClient);
        setAiConsent((current) => ({ current: false, version: current?.version ?? null }));
      }}
      onOpenUrl={async (url) => {
        await Linking.openURL(url);
      }}
      onLogOut={async () => {
        await billing.logOut().catch(() => undefined);
        await onboarding.markLoggedOut();
        await auth.logOut("user");
      }}
      hasManagedSubscription={hasManagedSubscription}
      onDeleteAccount={async () => {
        const accessToken = auth.session?.access_token;
        if (!accessToken) throw new Error("Sign in again before deleting your account.");

        await billing.prepareAccountDeletion();
        try {
          await deleteAccount({ accessToken });
        } catch (error) {
          await billing.restoreAfterFailedAccountDeletion().catch(() => undefined);
          throw error;
        }

        await onboarding.markLoggedOut();
        await auth.logOut("user");
        router.replace("/login?accountDeleted=1" as Href);
      }}
      onReauthorizeApple={auth.signInWithApple}
      />
    </>
  );
}
