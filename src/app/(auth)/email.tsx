import { type Href, useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { EmailEntryScreen, type EmailAuthIntent } from "@/screens/auth/email-auth-screens";

function authIntent(value: string | string[] | undefined): EmailAuthIntent {
  return (Array.isArray(value) ? value[0] : value) === "onboarding" ? "onboarding" : "login";
}

export default function EmailRoute() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = authIntent(params.intent);

  return <EmailEntryScreen intent={intent} busy={auth.emailBusy === "sending"} error={auth.error} onBack={() => router.back()} onSubmit={(email) => void auth.sendEmailCode(email).then((sent) => {
    if (sent) router.push(`/(auth)/email-code?intent=${intent}&email=${encodeURIComponent(email)}` as Href);
  })} />;
}
