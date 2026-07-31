import { type Href, useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { LoginScreen } from "@/screens/auth";

export default function LoginRoute() {
  const router = useRouter();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const auth = useAuth();
  return (
    <LoginScreen
      initialError={auth.callbackError}
      initialNotice={reset === "complete" ? "Password updated. Log in with your new password." : null}
      onSubmit={async (email, password) => {
        await auth.logIn(email, password);
      }}
      onCreateAccount={() => router.push("/sign-up" as Href)}
      onForgotPassword={() => router.push("/forgot-password" as Href)}
    />
  );
}
