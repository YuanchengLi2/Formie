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
  const { error: routeError, returnTo, accountDeleted } = useLocalSearchParams<{ error?: string; returnTo?: string; accountDeleted?: string }>();
  const legal = (() => { try { return getLegalLinks(); } catch { return null; } })();
  const beginAppleSignIn = async () => {
    const target = Array.isArray(returnTo) ? returnTo[0] : returnTo;
    if (target === "/subscription") await setAuthReturnTarget(target);
    await onboarding.startOAuth("login");
    await auth.signInWithProvider("apple");
  };
  const deleted = (Array.isArray(accountDeleted) ? accountDeleted[0] : accountDeleted) === "1";
  const deletionNotice = deleted
    ? "Your Formie account and Formie-controlled data were deleted. If you used Sign in with Apple, you can also remove Formie in Apple ID Settings under Sign-In & Security > Sign in with Apple."
    : null;
  return <SocialLoginScreen busyProvider={auth.signingIn} error={auth.error ?? (Array.isArray(routeError) ? routeError[0] : routeError) ?? null} notice={deletionNotice}
    onBack={() => router.back()}
    onOAuth={() => void beginAppleSignIn()}
    onCreateAccount={() => void onboarding.startNewAccount().then(() => router.replace("/onboarding/welcome" as Href))}
    onOpenTerms={() => { if (legal) void Linking.openURL(legal.termsUrl); }}
    onOpenPrivacy={() => { if (legal) void Linking.openURL(legal.privacyUrl); }} />;
}
