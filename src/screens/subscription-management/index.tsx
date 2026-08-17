import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { ImageBackground, Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SubscriptionBoundary } from "@/components/subscription-boundary";
import { useAccess, useBillingSurfaceRefresh } from "@/features/access/access-provider";
import { useBilling } from "@/features/billing/billing-provider";
import { createSubscriptionPresentation } from "@/features/billing/subscription-management-presentation";
import { colors } from "@/theme/colors";

const background = require("../../../assets/production/subscription/subscription-background.png");
const mark = require("../../../assets/images/form-logo-mark.png");

export function SubscriptionManagementScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const accessState = useAccess();
  const billing = useBilling();
  const access = accessState.access;
  const presentation = createSubscriptionPresentation(access);
  const scale = Math.min(1.08, Math.max(0.82, width / 426.5));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBillingSurfaceRefresh();

  const provider = access.store === "app_store" || access.store === "mac_app_store" || !access.store ? "Apple" : "your app store";
  const manage = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await billing.manageSubscription();
    } catch {
      setError(`The ${provider} subscription screen could not be opened. Check the account on this device and try again.`);
    } finally {
      setBusy(false);
    }
  };
  const purchase = () => router.replace("/subscription" as Href);
  const remaining = access.remaining ?? 0;
  const limit = access.quotaLimit ?? 10;

  return (
    <ImageBackground source={background} resizeMode="cover" style={styles.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 10 * scale, paddingBottom: Math.max(insets.bottom, 20) + 20 * scale, paddingHorizontal: 22 * scale }}
      >
        <View style={[styles.header, { height: 48 * scale }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [styles.back, { width: 42 * scale, height: 42 * scale, borderRadius: 21 * scale, opacity: pressed ? 0.65 : 1 }]}>
            <Text style={{ color: colors.text, fontSize: 29 * scale, lineHeight: 31 * scale, marginTop: -2 * scale }}>‹</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { fontSize: 18 * scale }]}>Subscription</Text>
          <View style={{ width: 42 * scale }} />
        </View>

        <View style={{ alignItems: "center", paddingTop: 20 * scale }}>
          <View style={[styles.heroHalo, { width: 116 * scale, height: 116 * scale, borderRadius: 58 * scale }]}>
            <View style={[styles.heroDisc, { width: 84 * scale, height: 84 * scale, borderRadius: 42 * scale }]}>
              <Image source={mark} contentFit="contain" accessibilityLabel="Formie" style={{ width: 45 * scale, height: 45 * scale }} />
            </View>
          </View>
          <Text accessibilityRole="header" style={[styles.headline, { fontSize: 34 * scale, lineHeight: 38 * scale, marginTop: 18 * scale }]}>
            {presentation.headlineLead}{"\n"}<Text style={{ color: colors.gold }}>{presentation.headlineAccent}</Text>
          </Text>
          {access.paidThrough ? (
            <SubscriptionBoundary
              access={{ lifecycleState: access.lifecycleState, willRenew: access.willRenew, paidThrough: access.paidThrough, sandbox: access.sandbox }}
              onBoundary={() => void accessState.reconcile()}
              style={{ alignItems: "center", marginTop: 10 * scale }}
              countdownStyle={{ fontSize: 14 * scale, lineHeight: 19 * scale }}
              timestampStyle={{ fontSize: 11.5 * scale, lineHeight: 17 * scale, textAlign: "center" }}
            />
          ) : null}
        </View>

        <View style={[styles.planCard, { borderRadius: 26 * scale, marginTop: 25 * scale, padding: 20 * scale }]}>
          <View style={styles.planTop}>
            <View style={styles.planIdentity}>
              <View style={[styles.crown, { width: 43 * scale, height: 43 * scale, borderRadius: 14 * scale }]}><Text style={{ color: colors.gold, fontSize: 22 * scale }}>♛</Text></View>
              <View>
                <Text style={[styles.planName, { fontSize: 20 * scale }]}>Formie Monthly</Text>
                <Text style={[styles.planSub, { fontSize: 11 * scale }]}>10 video analyses each billing period</Text>
              </View>
            </View>
            <View style={[styles.badge, { paddingHorizontal: 11 * scale, paddingVertical: 6 * scale }]}><Text style={[styles.badgeText, { fontSize: 10 * scale }]}>{presentation.badgeLabel}</Text></View>
          </View>

          <View style={[styles.divider, { marginVertical: 17 * scale }]} />
          <PlanRow label="Automatic renewal" value={presentation.automaticRenewalValue} scale={scale} gold={presentation.automaticRenewalValue === "On"} />
          <View style={{ height: 13 * scale }} />
          <PlanRow label={presentation.boundaryRowLabel} value={access.paidThrough ? "See live time below" : "After Apple confirms"} scale={scale} />
          {access.paidThrough ? (
            <SubscriptionBoundary
              access={{ lifecycleState: access.lifecycleState, willRenew: access.willRenew, paidThrough: access.paidThrough, sandbox: access.sandbox }}
              onBoundary={() => void accessState.reconcile()}
              style={{ marginTop: 7 * scale }}
              countdownStyle={{ fontSize: 12 * scale }}
              timestampStyle={{ fontSize: 10.5 * scale }}
            />
          ) : null}
          <View style={[styles.quota, { marginTop: 17 * scale, borderRadius: 15 * scale, padding: 14 * scale }]}>
            <Text style={[styles.quotaValue, { fontSize: 18 * scale }]}>{remaining}/{limit}</Text>
            <Text style={[styles.quotaLabel, { fontSize: 11.5 * scale }]}>analyses remaining in this provider period</Text>
          </View>
        </View>

        {presentation.showManage ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Manage in ${provider}`} disabled={busy} onPress={() => void manage()} style={({ pressed }) => [styles.primaryButton, { height: 58 * scale, borderRadius: 17 * scale, marginTop: 18 * scale, opacity: busy || pressed ? 0.75 : 1 }]}>
            <Text style={[styles.apple, { fontSize: 21 * scale }]}>●</Text><Text style={[styles.primaryLabel, { fontSize: 16 * scale }]}>{busy ? `Opening ${provider}…` : `Manage in ${provider}`}</Text>
          </Pressable>
        ) : null}
        {presentation.showPurchase ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Resubscribe in Formie" onPress={purchase} style={({ pressed }) => [styles.secondaryButton, { height: 56 * scale, borderRadius: 17 * scale, marginTop: 12 * scale, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.secondaryLabel, { fontSize: 15 * scale }]}>{access.lifecycleState === "not_subscribed" ? "Subscribe to Formie" : "Resubscribe to Formie"}</Text>
          </Pressable>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={[styles.error, { marginTop: 10 * scale }]}>{error}</Text> : null}

        <View style={[styles.supportCard, { borderRadius: 22 * scale, marginTop: 18 * scale, padding: 18 * scale }]}>
          <View style={{ flex: 1 }}><Text style={[styles.supportTitle, { fontSize: 15 * scale }]}>Need help?</Text><Text style={[styles.supportCopy, { fontSize: 11.5 * scale, lineHeight: 17 * scale }]}>We can help with access, billing, or your Apple subscription.</Text></View>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL("mailto:support@formie.app")}><Text style={[styles.supportLink, { fontSize: 12 * scale }]}>Contact support</Text></Pressable>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

function PlanRow({ label, value, scale, gold = false }: { label: string; value: string; scale: number; gold?: boolean }) {
  return <View style={styles.row}><Text style={[styles.rowLabel, { fontSize: 12 * scale }]}>{label}</Text><Text style={[styles.rowValue, { fontSize: 12 * scale, color: gold ? colors.gold : colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050505" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", backgroundColor: "rgba(22,22,22,0.86)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.gold, fontWeight: "700", letterSpacing: 0.25 },
  heroHalo: { backgroundColor: "rgba(201,169,107,0.08)", borderWidth: 1, borderColor: "rgba(201,169,107,0.15)", alignItems: "center", justifyContent: "center", shadowColor: colors.gold, shadowOpacity: 0.35, shadowRadius: 28 },
  heroDisc: { backgroundColor: "rgba(20,19,16,0.95)", borderWidth: 1, borderColor: "rgba(201,169,107,0.4)", alignItems: "center", justifyContent: "center" },
  headline: { color: colors.text, textAlign: "center", fontWeight: "700", letterSpacing: -1.1 },
  planCard: { backgroundColor: "rgba(18,18,18,0.91)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  planTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  planIdentity: { flexDirection: "row", alignItems: "center", gap: 11, flexShrink: 1 },
  crown: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: "rgba(200,169,107,0.28)", alignItems: "center", justifyContent: "center" },
  planName: { color: colors.text, fontWeight: "700", letterSpacing: -0.35 },
  planSub: { color: colors.textSecondary, marginTop: 3 },
  badge: { borderRadius: 999, backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: "rgba(200,169,107,0.42)" },
  badgeText: { color: colors.gold, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.10)" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: colors.textSecondary },
  rowValue: { fontWeight: "600", textAlign: "right" },
  quota: { flexDirection: "row", alignItems: "baseline", gap: 8, backgroundColor: "rgba(200,169,107,0.11)", borderWidth: 1, borderColor: "rgba(200,169,107,0.24)" },
  quotaValue: { color: colors.gold, fontWeight: "800" },
  quotaLabel: { color: "#D7C59D", flex: 1 },
  primaryButton: { backgroundColor: colors.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  apple: { color: "#080808" },
  primaryLabel: { color: "#080808", fontWeight: "800" },
  secondaryButton: { borderWidth: 1, borderColor: colors.gold, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(6,6,6,0.64)" },
  secondaryLabel: { color: colors.gold, fontWeight: "700" },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: "center" },
  supportCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "rgba(15,15,15,0.88)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  supportTitle: { color: colors.text, fontWeight: "700" },
  supportCopy: { color: colors.textSecondary, marginTop: 4 },
  supportLink: { color: colors.gold, fontWeight: "700" },
});
