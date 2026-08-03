import { useAuth } from "@/features/auth/auth-provider";
import { ResetPasswordScreen } from "@/screens/auth";

export default function ResetPasswordRoute() {
  const auth = useAuth();
  return (
    <ResetPasswordScreen
      onSubmit={async (password) => {
        await auth.updateRecoveredPassword(password);
      }}
    />
  );
}
