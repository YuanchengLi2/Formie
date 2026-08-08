import * as Linking from "expo-linking";
import { useEffect } from "react";
import { Redirect, type Href, useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { useBilling } from "@/features/billing/billing-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { isOnboardingStep, nextOnboardingStep, previousOnboardingStep } from "@/features/onboarding/types";
import { useProfile } from "@/features/profile/profile-provider";
import { ApprovedOnboardingScreen } from "@/screens/onboarding";

export default function OnboardingStepRoute() {
  const { step: rawStep } = useLocalSearchParams<{ step?: string }>();
  const router = useRouter();
  const auth = useAuth();
  const onboarding = useOnboarding();
  const billing = useBilling();
  const profile = useProfile();
  const step = Array.isArray(rawStep) ? rawStep[0] : rawStep;

  useEffect(() => {
    if (step === "create-account" && auth.phase === "authenticated" && onboarding.status === "premium_required") router.replace("/subscription" as Href);
    if (step === "premium" && onboarding.status === "complete") router.replace("/(tabs)/(home)" as Href);
  }, [auth.phase, onboarding.status, router, step]);

  if (!isOnboardingStep(step)) return <Redirect href={"/onboarding/welcome" as Href} />;
  const legal = (() => { try { return getLegalLinks(); } catch { return null; } })();
  const go = async (target: typeof step) => { await onboarding.setStep(target); router.replace(("/onboarding/" + target) as Href); };
  const finishLoading = async () => {
    if (auth.phase === "authenticated" && auth.user) await onboarding.markAuthenticated(auth.user.id);
    else await onboarding.requireAccount();
    router.replace("/onboarding/create-account" as Href);
  };
  const next = nextOnboardingStep(step);
  const previous = previousOnboardingStep(step);

  return <ApprovedOnboardingScreen
    step={step}
    answers={onboarding.answers}
    onAnswerChange={(field, value) => void onboarding.updateAnswer(field, value)}
    onNext={() => { if (next) void go(next); }}
    onBack={() => { if (previous) void go(previous); }}
    onLoadingComplete={() => void finishLoading()}
    onOAuth={(provider) => void onboarding.startOAuth("create_account").then(() => auth.signInWithProvider(provider))}
    onEmail={() => void onboarding.startOAuth("create_account").then(() => router.push("/email?intent=onboarding" as Href))}
    onRestoreAccount={() => void onboarding.markLoggedOut().then(() => router.replace("/login" as Href))}
    onSignIn={() => router.replace("/login" as Href)}
    onOpenTerms={() => { if (legal) void Linking.openURL(legal.termsUrl); }}
    onOpenPrivacy={() => { if (legal) void Linking.openURL(legal.privacyUrl); }}
    onPurchase={() => void billing.purchase("monthly").then((outcome) => outcome === "active" ? onboarding.completeAccess() : undefined)}
    price={billing.plans.monthly?.priceString ?? "—"}
    purchaseAvailable={Boolean(billing.plans.monthly)}
    purchaseState={billing.state}
    onRetrySync={() => void billing.retryPurchaseSync().then((active) => active ? onboarding.completeAccess() : undefined)}
    busyProvider={auth.signingIn}
    busy={auth.signingIn !== null || (step === "create-account" && onboarding.status === "profile_sync_required" && profile.status === "loading") || billing.state === "loading" || billing.state === "purchasing" || billing.state === "reconciling" || billing.state === "restoring"}
    error={profile.error ?? auth.error ?? billing.error}
  />;
}
