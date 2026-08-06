import { useEffect } from "react";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { AuthLoadingScreen } from "@/screens/auth";

export default function AuthCallbackRoute() {
  const auth = useAuth();
  const { completeOAuthCode } = auth;
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const callbackCode = Array.isArray(code) ? code[0] : code;

  useEffect(() => {
    if (callbackCode) void completeOAuthCode(callbackCode);
  }, [callbackCode, completeOAuthCode]);

  useEffect(() => {
    if (auth.phase === "authenticated") {
      router.replace("/" as Href);
      return;
    }
    if (auth.phase === "signed_out" && auth.signingIn === null) {
      router.replace(`/login?error=${encodeURIComponent(auth.error ?? "Sign in was not completed. Please try again.")}` as Href);
    }
  }, [auth.error, auth.phase, auth.signingIn, router]);

  return <AuthLoadingScreen message="Confirming your account..." />;
}
