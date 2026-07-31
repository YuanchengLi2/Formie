import { type Href, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { ResetPasswordScreen } from "@/screens/auth";

export default function ResetPasswordRoute() {
  const router = useRouter();
  const auth = useAuth();
  return (
    <ResetPasswordScreen
      onSubmit={async (password) => {
        await auth.updateRecoveredPassword(password);
        router.replace("/login?reset=complete" as Href);
      }}
    />
  );
}
