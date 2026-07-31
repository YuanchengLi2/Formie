import { type Href, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { ChangePasswordScreen } from "@/screens/account";

export default function ChangePasswordRoute() {
  const auth = useAuth();
  const router = useRouter();
  return (
    <ChangePasswordScreen
      onRequestCode={auth.requestPasswordChange}
      onUpdate={auth.updatePassword}
      onComplete={() => router.replace("/(tabs)/(profile)" as Href)}
    />
  );
}
