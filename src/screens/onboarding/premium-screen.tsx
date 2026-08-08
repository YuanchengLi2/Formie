import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PurchaseState } from "@/features/billing/types";

export type PremiumScreenProps = {
  price: string;
  purchaseAvailable: boolean;
  busy: boolean;
  state?: PurchaseState;
  error?: string | null;
  onBack?: () => void;
  onPurchase: () => void;
  onPurchasePlan?: (plan: "monthly") => void;
  onRetrySync?: () => void;
};

const benefits = [
  { id: "analyses", label: "10 analyses / month", glyph: "◫" },
  { id: "coaching", label: "Personalized corrections", glyph: "◎" },
  { id: "progress", label: "Progress tracking", glyph: "↗" },
] as const;

const cardBackground = require("../../../assets/production/paywall/pro-card-background.png");

export function PremiumScreen({ price, purchaseAvailable, busy, state = "idle", error, onBack, onPurchase, onPurchasePlan, onRetrySync }: PremiumScreenProps) {
  const insets = useSafeAreaInsets();
  const billingState = state as string;
  const reconciling = busy || billingState === "purchasing" || billingState === "reconciling";
  const syncRequired = billingState === "sync_required";
  const ctaLabel = syncRequired ? "Check purchase" : reconciling ? "Starting..." : "Start monthly - " + price + "/mo";
  const purchase = () => {
    if (syncRequired) {
      onRetrySync?.();
      return;
    }
    if (onPurchasePlan) onPurchasePlan("monthly");
    else onPurchase();
  };
  const ctaDisabled = reconciling || (!purchaseAvailable && !syncRequired);

  return (
    <View testID="premium-native-screen" style={[styles.screen, { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 10) }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={!onBack} onPress={onBack} style={({ pressed }) => [styles.back, { opacity: onBack ? pressed ? 0.65 : 1 : 0 }]}>
          <Text selectable={false} style={styles.backText}>‹</Text>
        </Pressable>
        <Text selectable style={styles.headerTitle}>Formie plans</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View testID="premium-pro-card" style={styles.planCard}>
          <Image testID="premium-pro-card-art" source={cardBackground} contentFit="cover" style={StyleSheet.absoluteFillObject} />
          <View style={styles.planCopy}>
            <View style={styles.badge}>
              <Text selectable={false} style={styles.badgeStar}>★</Text>
              <Text selectable style={styles.badgeText}>Most popular</Text>
            </View>
            <Text selectable style={styles.planName}>Pro</Text>
            <View style={styles.priceRow}>
              <Text selectable style={styles.price}>{price}</Text>
              <Text selectable style={styles.period}>/mo</Text>
            </View>
            <Text selectable style={styles.description}>For lifters who want better form,{"\n"}better feedback, and faster progress.</Text>
          </View>
        </View>

        <View style={styles.unlock}>
          <Text selectable style={styles.unlockTitle}>What you unlock</Text>
          {benefits.map((benefit) => (
            <View key={benefit.id} testID={"premium-benefit-" + benefit.id} style={styles.benefit}>
              <View testID={"premium-benefit-icon-" + benefit.id} style={styles.benefitIcon}>
                <Text selectable={false} style={styles.benefitGlyph}>{benefit.glyph}</Text>
              </View>
              <Text testID={"premium-benefit-text-" + benefit.id} selectable style={styles.benefitText}>{benefit.label}</Text>
            </View>
          ))}
        </View>

        {error ? <Text selectable accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <Pressable
        testID="onboarding-bottom-cta"
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        accessibilityState={{ disabled: ctaDisabled }}
        disabled={ctaDisabled}
        onPress={purchase}
        style={({ pressed }) => [styles.cta, { opacity: ctaDisabled ? 0.45 : pressed ? 0.82 : 1 }]}
      >
        {reconciling ? <ActivityIndicator color="#080808" /> : null}
        <Text selectable={false} style={styles.ctaText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#050505", paddingHorizontal: 10 },
  header: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, borderCurve: "continuous", borderWidth: 1, borderColor: "#343434", backgroundColor: "#151515" },
  backText: { color: "#F4F1E9", fontSize: 32, lineHeight: 34, marginTop: -2 },
  headerTitle: { color: "#F5F3EF", fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.3 },
  headerSpacer: { width: 44 },
  scroll: { flex: 1 },
  scrollContent: { gap: 0, paddingTop: 6, paddingBottom: 18 },
  planCard: { minHeight: 254, height: 254, overflow: "hidden", borderRadius: 5, borderCurve: "continuous", backgroundColor: "#C99223" },
  planCopy: { width: "74%", minHeight: 254, padding: 22, gap: 0 },
  badge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, backgroundColor: "rgba(255,248,222,0.86)" },
  badgeStar: { color: "#302006", fontSize: 13 },
  badgeText: { color: "#302006", fontSize: 12, fontWeight: "800" },
  planName: { color: "#080808", fontSize: 39, lineHeight: 44, fontWeight: "900", marginTop: 14 },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 0 },
  price: { color: "#080808", fontSize: 39, lineHeight: 45, fontWeight: "900", fontVariant: ["tabular-nums"] },
  period: { color: "#080808", fontSize: 19, lineHeight: 25, fontWeight: "800", paddingBottom: 3, paddingLeft: 4 },
  description: { color: "#211706", fontSize: 16, lineHeight: 23, fontWeight: "600", marginTop: 14 },
  unlock: { marginTop: 38 },
  unlockTitle: { color: "#F3F1EC", fontSize: 19, lineHeight: 25, fontWeight: "800", paddingBottom: 10 },
  benefit: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 15, borderTopWidth: 1, borderTopColor: "#292929" },
  benefitIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#D9A536" },
  benefitGlyph: { color: "#E7B33C", fontSize: 21, lineHeight: 24, fontWeight: "800" },
  benefitText: { flex: 1, color: "#E8E4DB", fontSize: 17, lineHeight: 22, fontWeight: "600" },
  error: { marginTop: 16, color: "#FF8A82", fontSize: 13, lineHeight: 18, textAlign: "center" },
  cta: { minHeight: 58, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center", borderRadius: 5, borderCurve: "continuous", backgroundColor: "#F2B62E", paddingHorizontal: 14 },
  ctaText: { color: "#080808", fontSize: 17, fontWeight: "900", textAlign: "center" },
});
