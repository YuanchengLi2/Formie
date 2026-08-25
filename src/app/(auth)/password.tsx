import { type Href, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { PasswordSignInScreen } from "@/screens/auth/email-auth-screens";

export default function PasswordRoute() {
  const auth = useAuth();
  const router = useRouter();

  return <PasswordSignInScreen busy={auth.emailBusy === "password"} error={auth.error} onBack={() => router.back()} onSubmit={(email, password) => void auth.signInWithPassword(email, password).then((signedIn) => {
    if (signedIn) router.replace("/" as Href);
  })} />;
}
