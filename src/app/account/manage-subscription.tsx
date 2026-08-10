import { useState } from "react";
import { type Href, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { FormButton } from "@/components/form-button";
import { useAccess } from "@/features/access/access-provider";
import { formatSubscriptionStateLabel } from "@/features/access/account-access";
import { useBilling } from "@/features/billing/billing-provider";
import { subscriptionManagementCopy } from "@/features/billing/subscription-management";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export default function ManageSubscriptionRoute() {
  const router = useRouter();
  const access = useAccess();
  const billing = useBilling();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (access.access.status === "expired" || access.access.lifecycleState === "not_subscribed") {
    return <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg, padding: spacing.xl, backgroundColor: colors.background }}>
      <Text selectable style={[typography.title, { color: colors.text }]}>Your subscription has ended</Text>
      <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Start a new Apple sandbox purchase in Formie. Access and analyses return only after Apple, RevenueCat, and Formie confirm the new paid period.</Text>
      <FormButton label="Resubscribe in Formie" onPress={() => router.replace("/subscription" as Href)} />
    </View>;
  }

  const copy = subscriptionManagementCopy(access.access.lifecycleState, access.access.paidThrough);
  const provider = access.access.store === "app_store" || access.access.store === "mac_app_store" ? "Apple" : "your app store";
  const manage = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await billing.manageSubscription();
    } catch {
      setError(`The ${provider} subscription screen could not be opened. Check the sandbox account on this device and try again.`);
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl }}>
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={[typography.title, { color: colors.text }]}>{copy.title}</Text>
      <Text selectable style={[typography.body, { color: colors.textSecondary }]}>{copy.detail}</Text>
    </View>
    <View style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <Text selectable style={[typography.label, { color: colors.text }]}>Formie Monthly</Text>
      <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>{formatSubscriptionStateLabel(access.access)}</Text>
      <Text selectable style={[typography.caption, { color: colors.gold }]}>{access.access.remaining ?? 0}/{access.access.quotaLimit ?? 10} analyses remaining</Text>
    </View>
    <FormButton label={busy ? `Opening ${provider}...` : `Manage in ${provider}`} disabled={busy} onPress={() => void manage()} />
    {error ? <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
  </ScrollView>;
}
