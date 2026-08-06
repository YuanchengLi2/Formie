import { Redirect, type Href, useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { EmailCodeScreen, type EmailAuthIntent } from "@/screens/auth/email-auth-screens";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function EmailCodeRoute() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; intent?: string }>();
  const email = first(params.email).trim().toLowerCase();
  const intent: EmailAuthIntent = first(params.intent) === "onboarding" ? "onboarding" : "login";
  if (!email) return <Redirect href={`/(auth)/email?intent=${intent}` as Href} />;

  return <EmailCodeScreen email={email} intent={intent} busy={auth.emailBusy !== null} error={auth.error} onBack={() => router.back()} onResend={() => void auth.sendEmailCode(email)} onVerify={(code) => void auth.verifyEmailCode(email, code).then((verified) => {
    if (verified) router.replace("/" as Href);
  })} />;
}
