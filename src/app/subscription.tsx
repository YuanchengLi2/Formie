import { useEffect } from "react";
import * as Linking from "expo-linking";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { useAccess } from "@/features/access/access-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { useBilling } from "@/features/billing/billing-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { resolveSubscriptionView } from "@/features/billing/subscription-view";
import { PremiumScreen } from "@/screens/onboarding/premium-screen";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";
import { setAuthReturnTarget } from "@/features/auth/auth-return-target";

export default function SubscriptionRoute() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const completionTarget: Href = returnTo === "/exercise-selection" ? "/exercise-selection" : "/(tabs)/(home)";
  const auth = useAuth();
  const billing = useBilling();
  const access = useAccess();
  const onboarding = useOnboarding();
  const completeAccess = onboarding.completeAccess;
  const view = resolveSubscriptionView(access.access.status, access.access.lifecycleState, access.access.remaining);
  const legal = (() => { try { return getLegalLinks(); } catch { return null; } })();

  useEffect(() => {
    if (auth.phase !== "signed_out") return;
    void setAuthReturnTarget("/subscription").finally(() => {
      router.replace("/login?returnTo=%2Fsubscription" as Href);
    });
  }, [auth.phase, router]);

  useEffect(() => {
    if (view.mode !== "completed_account") return;
    if (onboarding.status === "premium_required") {
      void completeAccess().then(() => router.replace(completionTarget));
      return;
    }
    router.replace(completionTarget);
  }, [completeAccess, completionTarget, onboarding.status, router, view.mode]);

  const completePurchase = async () => {
    await access.refresh().catch(() => undefined);
    await onboarding.completeAccess();
    router.replace(completionTarget);
  };

  const finish = async () => {
    if (auth.phase !== "authenticated") {
      await setAuthReturnTarget("/subscription");
      router.replace("/login?returnTo=%2Fsubscription" as Href);
      return;
    }
    const outcome = await billing.purchase("monthly");
    if (outcome === "active") await completePurchase();
  };

  const purchasing = billing.state === "purchasing" || billing.state === "reconciling";

  if (auth.phase !== "authenticated") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

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
    price={billing.plans.monthly?.priceString ?? "Unavailable"}
    purchaseAvailable={Boolean(billing.plans.monthly)}
    busy={purchasing}
    state={billing.state}
    error={billing.error}
    restoreMessage={billing.restoreMessage}
    onBack={() => router.back()}
    onRestore={() => void billing.restore().then((active) => active ? completePurchase() : undefined)}
    onOpenTerms={() => { if (legal) void Linking.openURL(legal.termsUrl); }}
    onOpenPrivacy={() => { if (legal) void Linking.openURL(legal.privacyUrl); }}
    onRetrySync={() => void billing.retryPurchaseSync().then((active) => active ? completePurchase() : undefined)}
    onPurchase={() => void finish()}
  />;
}
