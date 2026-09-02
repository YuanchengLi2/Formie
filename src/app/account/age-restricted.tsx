import { Linking } from "react-native";
import { type Href, useRouter } from "expo-router";

import { AgeRestrictedScreen } from "@/screens/age-restricted";
import { useAuth } from "@/features/auth/auth-provider";
import { useBilling } from "@/features/billing/billing-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { deleteAccount } from "@/features/account-deletion/api";

export default function AgeRestrictedRoute() {
  const auth = useAuth();
  const billing = useBilling();
  const onboarding = useOnboarding();
  const router = useRouter();

  const finishLogout = async () => {
    await billing.logOut().catch(() => undefined);
    await onboarding.markLoggedOut();
    await auth.logOut("user");
  };

  return (
    <AgeRestrictedScreen
      onContactSupport={() => { void Linking.openURL("mailto:support@useformie.com"); }}
      onManageSubscription={() => { void billing.manageSubscription(); }}
      onLogOut={finishLogout}
      onDeleteAccount={async () => {
        const accessToken = auth.session?.access_token;
        if (!accessToken) throw new Error("Sign in again before deleting your account.");
        await billing.prepareAccountDeletion();
        try {
          await deleteAccount({ accessToken });
        } catch (error) {
          await billing.restoreAfterFailedAccountDeletion().catch(() => undefined);
          throw error;
        }
        await onboarding.markLoggedOut();
        await auth.logOut("user");
        router.replace("/login?accountDeleted=1" as Href);
      }}
    />
  );
}
