import { type Href, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { ForgotPasswordScreen } from "@/screens/auth";

export default function ForgotPasswordRoute() {
  const router = useRouter();
  const auth = useAuth();
  return (
    <ForgotPasswordScreen
      onSubmit={async (email) => {
        await auth.requestPasswordReset(email);
      }}
      onBackToLogin={() => router.replace("/login" as Href)}
    />
  );
}
