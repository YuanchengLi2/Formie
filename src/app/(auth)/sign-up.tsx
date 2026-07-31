import * as Linking from "expo-linking";
import { type Href, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { SignUpScreen } from "@/screens/auth";

export default function SignUpRoute() {
  const router = useRouter();
  const auth = useAuth();
  return (
    <SignUpScreen
      onSubmit={async (input) => {
        await auth.signUp(input);
      }}
      onOpenTerms={async () => {
        await Linking.openURL(getLegalLinks().termsUrl);
      }}
      onOpenPrivacy={async () => {
        await Linking.openURL(getLegalLinks().privacyUrl);
      }}
      onBackToLogin={() => router.replace("/login" as Href)}
    />
  );
}
