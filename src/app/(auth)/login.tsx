import * as Linking from "expo-linking";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/features/auth/auth-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { SocialLoginScreen } from "@/screens/auth";
import { setAuthReturnTarget } from "@/features/auth/auth-return-target";

export default function LoginRoute() {
  const auth = useAuth(); const onboarding = useOnboarding();
  const router = useRouter();
  const { error: routeError, returnTo } = useLocalSearchParams<{ error?: string; returnTo?: string }>();
  const legal = (() => { try { return getLegalLinks(); } catch { return null; } })();
  const beginAppleSignIn = async () => {
    const target = Array.isArray(returnTo) ? returnTo[0] : returnTo;
    if (target === "/subscription") await setAuthReturnTarget(target);
    await onboarding.startOAuth("login");
    await auth.signInWithProvider("apple");
  };
  return <SocialLoginScreen busyProvider={auth.signingIn} error={auth.error ?? (Array.isArray(routeError) ? routeError[0] : routeError) ?? null}
    onBack={() => router.back()}
    onOAuth={() => void beginAppleSignIn()}
    onEmail={() => void onboarding.startOAuth("login").then(() => router.push("/email?intent=login" as Href))}
    onCreateAccount={() => void onboarding.startNewAccount().then(() => router.replace("/onboarding/welcome" as Href))}
    onOpenTerms={() => { if (legal) void Linking.openURL(legal.termsUrl); }}
    onOpenPrivacy={() => { if (legal) void Linking.openURL(legal.privacyUrl); }} />;
}
