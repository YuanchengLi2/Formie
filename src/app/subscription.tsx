import * as Linking from "expo-linking";
import { useEffect } from "react";
import { type Href, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useAccess } from "@/features/access/access-provider";
import { useAuth } from "@/features/auth/auth-provider";
import { getLegalLinks } from "@/features/auth/legal-config";
import { useBilling } from "@/features/billing/billing-provider";
import { useOnboarding } from "@/features/onboarding/onboarding-store";
import { ApprovedOnboardingScreen } from "@/screens/onboarding";
import { FormButton } from "@/components/form-button";
import { resolveSubscriptionView } from "@/features/billing/subscription-view";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

function displayDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "Not available";
}

export default function SubscriptionRoute() {
  const router = useRouter(); const auth = useAuth(); const billing = useBilling(); const access = useAccess(); const onboarding = useOnboarding();
  const completeAccess = onboarding.completeAccess;
  useEffect(() => {
    if (access.access.status !== "active" || onboarding.status !== "premium_required") return;
    void completeAccess().then(() => router.replace("/(tabs)/(home)" as Href));
  }, [access.access.status, completeAccess, onboarding.status, router]);
  const legal = (() => { try { return getLegalLinks(); } catch { return null; } })();
  const finish = async (operation: () => Promise<boolean>) => {
    if (auth.phase !== "authenticated") { router.replace("/login" as Href); return; }
    if (await operation()) { await access.refresh().catch(() => undefined); await onboarding.completeAccess(); router.replace("/(tabs)/(home)" as Href); }
  };
  const view = resolveSubscriptionView(access.access.status, access.access.remaining, billing.subscription);
  if (view.mode === "verify") return <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: spacing.xl, gap: spacing.lg }}><Text selectable style={[typography.title, { color: colors.text }]}>Checking your subscription</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Formie could not confirm your current billing period yet. Your account remains protected while we retry.</Text><FormButton label="Try Again" onPress={() => void billing.load().then(() => access.refresh()).catch(() => undefined)} /></View>;
  if (view.mode !== "paywall") {
    const cancelled = view.mode === "active_cancelled";
    const manageUrl = billing.subscription?.managementURL ?? null;
    return <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}><Text selectable style={[typography.title, { color: colors.text }]}>Subscription</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Manage your Formie plan and monthly analyses.</Text></View>
      <View style={{ padding: spacing.lg, gap: spacing.md, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface }}>
        <Text selectable style={[typography.label, { color: colors.gold }]}>CURRENT PLAN</Text><Text selectable style={[typography.title, { color: colors.text }]}>Formie Pro</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{cancelled ? `Access through ${displayDate(billing.subscription?.expirationDate ?? access.access.periodEndsAt)}` : `Renews on ${displayDate(billing.subscription?.expirationDate ?? access.access.periodEndsAt)}`}</Text>
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.sm, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <Text selectable style={[typography.label, { color: colors.gold }]}>ANALYSES REMAINING</Text><Text selectable style={[typography.title, { color: colors.text, fontVariant: ["tabular-nums"] }]}>{access.access.remaining ?? "—"} / {access.access.quotaLimit ?? 10}</Text>
        <Text selectable style={[typography.body, { color: view.quotaExhausted ? colors.gold : colors.textSecondary }]}>{view.quotaExhausted ? `0 analyses left. Resets ${displayDate(access.access.periodEndsAt)}.` : `Resets ${displayDate(access.access.periodEndsAt)}.`}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !manageUrl }} disabled={!manageUrl} onPress={() => { if (manageUrl) void Linking.openURL(manageUrl); }} style={({ pressed }) => ({ minHeight: 62, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radii.md, borderCurve: "continuous", borderWidth: 1, borderColor: colors.gold, backgroundColor: pressed ? colors.goldSoft : colors.surface, opacity: manageUrl ? 1 : 0.55 })}><View style={{ flex: 1, gap: 3 }}><Text selectable style={[typography.heading, { color: colors.text }]}>{cancelled ? "Manage or Resubscribe" : "Cancel Subscription"}</Text><Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{manageUrl ? "Opens your app store subscription settings." : "Subscription management is unavailable for this test-store purchase."}</Text></View><Text selectable={false} style={{ color: colors.gold, fontSize: 24 }}>›</Text></Pressable>
    </ScrollView>;
  }
  return <ApprovedOnboardingScreen step="premium" answers={onboarding.answers} onAnswerChange={() => undefined} onNext={() => undefined} onBack={() => router.back()}
    onOAuth={() => undefined} onEmail={() => undefined} onRestoreAccount={() => undefined}
    onOpenTerms={() => { if (legal) void Linking.openURL(legal.termsUrl); }} onOpenPrivacy={() => { if (legal) void Linking.openURL(legal.privacyUrl); }}
    onPurchase={() => void finish(billing.purchase)} price={billing.priceString ?? "—"} purchaseAvailable={Boolean(billing.offering?.packages[0])}
    busy={billing.state === "purchasing" || billing.state === "loading"} error={billing.error} />;
}
