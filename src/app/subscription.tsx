import { useEffect } from "react";
import { type Href, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { useAccess } from "@/features/access/access-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { useBilling } from "@/features/billing/billing-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { resolveSubscriptionView } from "@/features/billing/subscription-view";
import { PremiumScreen } from "@/screens/onboarding/premium-screen";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export default function SubscriptionRoute() {
  const router = useRouter();
  const auth = useAuth();
  const billing = useBilling();
  const access = useAccess();
  const onboarding = useOnboarding();
  const completeAccess = onboarding.completeAccess;
  const view = resolveSubscriptionView(access.access.status, access.access.lifecycleState, access.access.remaining);

  useEffect(() => {
    if (view.mode !== "completed_account") return;
    if (onboarding.status === "premium_required") {
      void completeAccess().then(() => router.replace("/(tabs)/(home)" as Href));
      return;
    }
    router.replace("/(tabs)/(home)" as Href);
  }, [completeAccess, onboarding.status, router, view.mode]);

  const completePurchase = async () => {
    await access.refresh().catch(() => undefined);
    await onboarding.completeAccess();
    router.replace("/(tabs)/(home)" as Href);
  };

  const finish = async () => {
    if (auth.phase !== "authenticated") {
      router.replace("/login" as Href);
      return;
    }
    const outcome = await billing.purchase("monthly");
    if (outcome === "active") await completePurchase();
  };

  const purchasing = billing.state === "purchasing" || billing.state === "reconciling";

  if (view.mode === "verify") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", gap: spacing.md }}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Checking your subscription...</Text>
      </View>
    );
  }

  if (view.mode === "completed_account") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return <PremiumScreen
    price={billing.plans.monthly?.priceString ?? "$9.99"}
    purchaseAvailable={Boolean(billing.plans.monthly)}
    busy={purchasing}
    state={billing.state}
    error={billing.error}
    onBack={() => router.back()}
    onRetrySync={() => void billing.retryPurchaseSync().then((active) => active ? completePurchase() : undefined)}
    onPurchase={() => void finish()}
  />;
}
