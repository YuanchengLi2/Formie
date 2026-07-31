import { type Href, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { ChangeEmailScreen } from "@/screens/account";

export default function ChangeEmailRoute() {
  const auth = useAuth();
  const router = useRouter();
  return (
    <ChangeEmailScreen
      currentEmail={auth.email ?? ""}
      onRequest={auth.requestEmailChange}
      onVerify={auth.verifyEmailChange}
      onResend={auth.resendEmailChange}
      onComplete={() => router.replace("/(tabs)/(profile)" as Href)}
    />
  );
}
