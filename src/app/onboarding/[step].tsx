import * as Linking from "expo-linking";
import { useEffect } from "react";
import { Redirect, type Href, useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { useBilling } from "@/features/billing/billing-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { isOnboardingStep, nextOnboardingStepForAnswers, previousOnboardingStepForAnswers } from "@/features/onboarding/types";
import { useProfile } from "@/features/profile/profile-provider";
import { useReferral } from "@/features/referrals/referral-provider";
import { ApprovedOnboardingScreen } from "@/screens/onboarding";
import { trackProductEvent } from "@/features/analytics/product-analytics";

export default function OnboardingStepRoute() {
  const { step: rawStep } = useLocalSearchParams<{ step?: string }>();
  const router = useRouter();
  const auth = useAuth();
  const onboarding = useOnboarding();
  const billing = useBilling();
  const profile = useProfile();
  const referral = useReferral();
  const step = Array.isArray(rawStep) ? rawStep[0] : rawStep;

  useEffect(() => {
    if (!isOnboardingStep(step)) return;
    void trackProductEvent(step === "premium" ? "paywall_viewed" : "onboarding_screen_viewed", step === "premium" ? { offerId: "monthly", source: "onboarding" } : { step, screenId: `onboarding/${step}`, onboardingVersion: "approved-v1" });
  }, [step]);

  useEffect(() => {
    if (step === "create-account" && auth.phase === "authenticated" && onboarding.status === "premium_required") router.replace("/subscription" as Href);
    if (step === "premium" && onboarding.status === "complete") router.replace("/(tabs)/(home)" as Href);
  }, [auth.phase, onboarding.status, router, step]);

  if (!isOnboardingStep(step)) return <Redirect href={"/onboarding/welcome" as Href} />;
  const legal = (() => { try { return getLegalLinks(); } catch { return null; } })();
  const go = async (target: typeof step) => {
    await trackProductEvent("onboarding_cta_pressed", { step, screenId: `onboarding/${step}`, onboardingVersion: "approved-v1" });
    if ((step === "acquisition-source" && onboarding.answers.acquisitionSource !== "affiliated_creator") || step === "creator-code") {
      await trackProductEvent("onboarding_questionnaire_completed", { onboardingVersion: "approved-v1" });
    }
    await onboarding.setStep(target);
    router.replace(("/onboarding/" + target) as Href);
  };
  const finishLoading = async () => {
    if (auth.phase === "authenticated" && auth.user) await onboarding.markAuthenticated(auth.user.id);
    else await onboarding.requireAccount();
    router.replace("/onboarding/create-account" as Href);
  };
  const openLogin = async () => {
    if (auth.phase === "authenticated") {
      await billing.logOut();
      await auth.logOut("user");
    }
    await onboarding.markLoggedOut();
    router.replace("/login" as Href);
  };
  const next = nextOnboardingStepForAnswers(step, onboarding.answers.acquisitionSource);
  const previous = previousOnboardingStepForAnswers(step, onboarding.answers.acquisitionSource);

  return <ApprovedOnboardingScreen
    step={step}
    answers={onboarding.answers}
    referralDisplayName={referral.pending?.creatorDisplayName ?? null}
    referralOffer={referral.pending ? "eligible" : null}
    referralCodeValidating={referral.validating}
    referralCodeError={referral.validationError}
    onValidateCreatorCode={referral.validateCode}
    onAnswerChange={(field, value) => {
      if (field === "acquisitionSource" && value !== "affiliated_creator") void referral.clear();
      void onboarding.updateAnswer(field, value);
    }}
    onNext={() => { if (next) void go(next); }}
    onBack={() => { if (previous) void go(previous); }}
    onLoadingComplete={() => void finishLoading()}
    onOAuth={() => void (async () => {
      await onboarding.startOAuth("create_account");
      const outcome = await auth.signInWithApple("create_account");
      if (outcome.status !== "authenticated") await onboarding.cancelOAuth();
    })()}
    onRestoreAccount={() => void openLogin()}
    onSignIn={() => void openLogin()}
    onOpenTerms={() => { if (legal) void Linking.openURL(legal.termsUrl); }}
    onOpenPrivacy={() => { if (legal) void Linking.openURL(legal.privacyUrl); }}
    onPurchase={() => void (async () => {
      await trackProductEvent("purchase_started", { offerId: "monthly", source: "onboarding" });
      const outcome = await billing.purchase("monthly");
      await trackProductEvent(outcome === "active" ? "purchase_succeeded" : outcome === "cancelled" ? "purchase_cancelled" : "purchase_failed", { offerId: "monthly", outcome });
      if (outcome === "active") await onboarding.completeAccess();
    })()}
    price={billing.plans.monthly?.priceString ?? "Unavailable"}
    purchaseAvailable={Boolean(billing.plans.monthly)}
    purchaseState={billing.state}
    restoreMessage={billing.restoreMessage}
    onRestore={() => void billing.restore().then(async (active) => {
      await trackProductEvent("purchase_restored", { outcome: active ? "active" : "none", source: "onboarding" });
      if (active) await onboarding.completeAccess();
    })}
    onRetrySync={() => void billing.retryPurchaseSync().then((active) => active ? onboarding.completeAccess() : undefined)}
    busyProvider={auth.signingIn}
    busy={auth.signingIn !== null || (step === "create-account" && onboarding.status === "profile_sync_required" && profile.status === "loading") || billing.state === "loading" || billing.state === "purchasing" || billing.state === "reconciling" || billing.state === "restoring"}
    error={profile.error ?? auth.error ?? billing.error}
  />;
}
