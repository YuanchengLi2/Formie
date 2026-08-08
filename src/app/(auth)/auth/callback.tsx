import { useEffect, useRef, useState } from "react";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { AuthLoadingScreen } from "@/screens/auth";

export default function AuthCallbackRoute() {
  const auth = useAuth();
  const onboarding = useOnboarding();
  const { markAuthenticated, oauthIntent, status: onboardingStatus } = onboarding;
  const { completeOAuthCode } = auth;
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const callbackCode = Array.isArray(code) ? code[0] : code;
  const [exchangeSettled, setExchangeSettled] = useState(!callbackCode);
  const handoffUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!callbackCode) {
      setExchangeSettled(true);
      return;
    }
    let active = true;
    setExchangeSettled(false);
    void completeOAuthCode(callbackCode).catch(() => false).finally(() => {
      if (active) setExchangeSettled(true);
    });
    return () => { active = false; };
  }, [callbackCode, completeOAuthCode]);

  useEffect(() => {
    if (!exchangeSettled) return;
    if (auth.phase === "authenticated") {
      if (onboardingStatus === "profile_sync_required") {
        router.replace("/onboarding/create-account" as Href);
        return;
      }
      if (auth.user && (onboardingStatus === "account_required" || oauthIntent === "create_account")) {
        if (handoffUserRef.current === auth.user.id) return;
        handoffUserRef.current = auth.user.id;
        void markAuthenticated(auth.user.id).finally(() => {
          router.replace("/onboarding/create-account" as Href);
        });
        return;
      }
      router.replace("/" as Href);
      return;
    }
    if (exchangeSettled && auth.phase === "signed_out" && auth.signingIn === null) {
      router.replace(`/login?error=${encodeURIComponent(auth.error ?? "Sign in was not completed. Please try again.")}` as Href);
    }
  }, [auth.error, auth.phase, auth.signingIn, auth.user, exchangeSettled, markAuthenticated, oauthIntent, onboardingStatus, router]);

  return <AuthLoadingScreen message="Confirming your account..." />;
}
