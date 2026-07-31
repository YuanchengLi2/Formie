import { type Href, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { VerifyEmailScreen } from "@/screens/auth";

export default function VerifyEmailRoute() {
  const router = useRouter();
  const auth = useAuth();
  return (
    <VerifyEmailScreen
      email={auth.email ?? "your email"}
      type={auth.verificationType ?? "signup"}
      callbackError={auth.callbackError}
      onResend={auth.resendVerification}
      onVerifyCode={async (code) => {
        await auth.verifyEmailOtp(code);
      }}
      onChangeEmail={async () => {
        const verificationType = auth.verificationType;
        await auth.changeVerificationEmail();
        router.replace((
          verificationType === "recovery"
            ? "/forgot-password"
            : auth.session?.user.is_anonymous
              ? "/sign-up"
              : "/login"
        ) as Href);
      }}
    />
  );
}
