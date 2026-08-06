import * as Linking from "expo-linking";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/features/auth/auth-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { SocialLoginScreen } from "@/screens/auth";

export default function LoginRoute() {
  const auth = useAuth(); const onboarding = useOnboarding();
  const router = useRouter();
  const { error: routeError } = useLocalSearchParams<{ error?: string }>();
  const legal = (() => { try { return getLegalLinks(); } catch { return null; } })();
  return <SocialLoginScreen busyProvider={auth.signingIn} error={auth.error ?? (Array.isArray(routeError) ? routeError[0] : routeError) ?? null}
    onOAuth={(provider) => void onboarding.startOAuth("login").then(() => auth.signInWithProvider(provider))}
    onEmail={() => void onboarding.startOAuth("login").then(() => router.push("/(auth)/email?intent=login" as Href))}
    onCreateAccount={() => void onboarding.startNewAccount().then(() => router.replace("/onboarding/welcome" as Href))}
    onOpenTerms={() => { if (legal) void Linking.openURL(legal.termsUrl); }}
    onOpenPrivacy={() => { if (legal) void Linking.openURL(legal.privacyUrl); }} />;
}
