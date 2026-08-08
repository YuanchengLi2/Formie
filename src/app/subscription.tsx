import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { type Href, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { AnalysisQuotaBar } from "@/components/analysis-quota-bar";
import { useAccess } from "@/features/access/access-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { useBilling } from "@/features/billing/billing-provider";
import type { BillingPlanCode } from "@/features/billing/types";
import { runSubscriptionTestControl, type SubscriptionTestAction } from "@/features/billing/subscription-test-controls";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { resolveSubscriptionView } from "@/features/billing/subscription-view";
import { formatBillingTimestamp } from "@/features/access/account-access";
import { formatQuotaMessage } from "@/features/access/quota-message";
import { PremiumScreen } from "@/screens/onboarding/premium-screen";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

function displayDate(value: string | null): string {
  return formatBillingTimestamp(value);
}

export default function SubscriptionRoute() {
  const router = useRouter();
  const auth = useAuth();
  const billing = useBilling();
  const access = useAccess();
  const onboarding = useOnboarding();
  const [testActionBusy, setTestActionBusy] = useState(false);
  const completeAccess = onboarding.completeAccess;

  useEffect(() => {
    if (access.access.status !== "active" || onboarding.status !== "premium_required") return;
    void completeAccess().then(() => router.replace("/(tabs)/(home)" as Href));
  }, [access.access.status, completeAccess, onboarding.status, router]);

  const completePurchase = async () => {
    await access.refresh().catch(() => undefined);
    await onboarding.completeAccess();
    router.replace("/(tabs)/(home)" as Href);
  };

  const finish = async (plan: BillingPlanCode) => {
    if (auth.phase !== "authenticated") {
      router.replace("/login" as Href);
      return;
    }
    const outcome = await billing.purchase(plan);
    if (outcome === "active") {
      await completePurchase();
    }
  };

  const view = resolveSubscriptionView(
    access.access.status,
    access.access.lifecycleState,
    access.access.remaining,
    access.access.planCode,
    Boolean(billing.plans.annual),
  );
  const purchasing = billing.state === "purchasing" || billing.state === "reconciling";

  if (view.mode === "verify") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", gap: spacing.md }}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Checking your subscription...</Text>
      </View>
    );
  }

  if (view.mode === "paywall") {
    return <PremiumScreen
      price={billing.plans.monthly?.priceString ?? "$9.99"}
      annualPrice={billing.plans.annual?.priceString ?? "$99.99"}
      purchaseAvailable={Boolean(billing.plans.monthly)}
      annualPurchaseAvailable={Boolean(billing.plans.annual)}
      busy={purchasing}
      state={billing.state}
      error={billing.error}
      onBack={() => router.back()}
      onRetrySync={() => void billing.retryPurchaseSync().then((active) => active ? completePurchase() : undefined)}
      onPurchase={() => void finish("monthly")}
      onPurchasePlan={(plan) => void finish(plan)}
    />;
  }

  const cancelled = view.mode === "active_cancelled";
  const manageUrl = billing.subscription?.managementURL ?? null;
  const isTestStore = (billing.subscription?.isSandbox ?? access.access.sandbox) && (billing.subscription?.store ?? access.access.store) === "test_store";
  const runTestAction = async (action: SubscriptionTestAction) => {
    if (testActionBusy) return;
    setTestActionBusy(true);
    try {
      await runSubscriptionTestControl(action);
      await access.refresh();
    } finally {
      setTestActionBusy(false);
    }
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}>
      <View style={{ height: 48, flexDirection: "row", alignItems: "center" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 28, color: colors.text, lineHeight: 30 }}>‹</Text>
        </Pressable>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Subscription</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Manage your Formie plan and monthly analyses.</Text>
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface }}>
        <Text selectable style={[typography.label, { color: colors.gold }]}>CURRENT PLAN</Text>
        <Text selectable style={[typography.title, { color: colors.text }]}>{access.access.planCode === "annual" ? "Formie Annual" : "Formie Monthly"}</Text>
        <Text selectable style={[typography.label, { color: cancelled ? colors.gold : colors.text }]}>● {cancelled ? "Canceled" : "Active"}</Text>
        <View style={{ gap: 3 }}>
          <Text selectable style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.8 }]}>{cancelled ? "ACCESS ENDS" : "NEXT BILLING"}</Text>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{displayDate(access.access.paidThrough)}</Text>
          <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{cancelled ? "You keep Formie Pro through this time." : "Your plan renews automatically at this time."}</Text>
        </View>
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.sm, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <Text selectable style={[typography.label, { color: colors.gold }]}>ANALYSES REMAINING</Text>
        <AnalysisQuotaBar remaining={access.access.remaining} limit={access.access.quotaLimit} status="ready" />
        <Text selectable style={[typography.body, { color: view.quotaExhausted ? colors.gold : colors.textSecondary }]}>{view.quotaExhausted
          ? formatQuotaMessage({ lifecycleState: access.access.lifecycleState, limit: access.access.quotaLimit, resetsAt: access.access.quotaResetsAt, paidThrough: access.access.paidThrough })
          : cancelled
            ? `Access ends ${displayDate(access.access.paidThrough)}.`
            : `Next 10 analyses ${displayDate(access.access.quotaResetsAt)}.`}</Text>
      </View>
      {view.planChange === "annual" ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Upgrade to Formie Annual" accessibilityState={{ disabled: purchasing }} disabled={purchasing} onPress={() => void finish("annual")} style={({ pressed }) => ({ minHeight: 58, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radii.md, borderCurve: "continuous", backgroundColor: colors.gold, opacity: pressed || purchasing ? 0.65 : 1 })}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={[typography.heading, { color: "#080808" }]}>{purchasing ? "Finishing upgrade..." : `Upgrade to Annual - ${billing.plans.annual?.priceString ?? "Store price"}/year`}</Text>
            <Text selectable style={[typography.caption, { color: "#352409" }]}>Starts a new annual plan with 10 analyses per month. Unused analyses never carry over.</Text>
          </View>
        </Pressable>
      ) : null}
      {isTestStore ? (
        <View style={{ gap: spacing.sm }}>
          <Text selectable style={[typography.label, { color: colors.gold }]}>TEST STORE RENEWAL</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={cancelled ? "Resume Subscription" : "Cancel at period end"} disabled={testActionBusy} onPress={() => void runTestAction(cancelled ? "uncancel" : "cancel_at_period_end")} style={({ pressed }) => ({ minHeight: 52, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radii.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: cancelled ? colors.gold : pressed ? colors.goldSoft : colors.surface, opacity: testActionBusy ? 0.55 : 1 })}>
            <Text selectable style={[typography.heading, { color: cancelled ? "#080808" : colors.text, textAlign: "center" }]}>{cancelled ? "Resume Subscription" : "Cancel at period end"}</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !manageUrl }} disabled={!manageUrl} onPress={() => { if (manageUrl) void Linking.openURL(manageUrl); }} style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radii.md, borderCurve: "continuous", borderWidth: 1, borderColor: colors.gold, backgroundColor: pressed ? colors.goldSoft : colors.surface, opacity: manageUrl ? 1 : 0.55 })}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text selectable style={[typography.heading, { color: colors.text }]}>{cancelled ? "Manage billing" : "Manage Subscription"}</Text>
          <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{manageUrl ? "Opens your app store subscription settings." : isTestStore ? "Use the Test Store control above to change renewal." : "Subscription management is not available on this device."}</Text>
        </View>
        <Text selectable={false} style={{ color: colors.gold, fontSize: 24 }}>›</Text>
      </Pressable>
    </ScrollView>
  );
}
