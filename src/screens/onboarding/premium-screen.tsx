import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { BillingPlanCode, PurchaseState } from "@/features/billing/types";
import { onboardingTheme as theme } from "@/theme/onboarding";

export type PremiumScreenProps = {
  price: string;
  annualPrice?: string;
  purchaseAvailable: boolean;
  annualPurchaseAvailable?: boolean;
  busy: boolean;
  state?: PurchaseState;
  error?: string | null;
  onBack?: () => void;
  onPurchase: () => void;
  onPurchasePlan?: (plan: BillingPlanCode) => void;
  onRetrySync?: () => void;
};

const benefits = [
  ["ANALYSES", "10 analyses / month", "▥"],
  ["COACHING", "Personalized corrections", "◎"],
  ["PROGRESS", "Progress tracking", "⌁"],
] as const;

const cardBackground = require("../../../assets/production/paywall/pro-card-background.png");
const socialProofAvatars = require("../../../assets/production/paywall/social-proof-avatars-hd.png");

export function PremiumScreen({ price, purchaseAvailable, busy, state = "idle", error, onBack, onPurchase, onPurchasePlan, onRetrySync }: PremiumScreenProps) {
  const insets = useSafeAreaInsets();
  const billingState = state as string;
  const reconciling = busy || billingState === "purchasing" || billingState === "reconciling";
  const syncRequired = billingState === "sync_required";
  const ctaLabel = syncRequired
    ? "Check purchase"
    : reconciling
      ? "Starting…"
      : `Start monthly — ${price}/mo`;
  const purchase = () => {
    if (syncRequired) {
      onRetrySync?.();
      return;
    }
    if (onPurchasePlan) onPurchasePlan("monthly");
    else onPurchase();
  };
  const ctaDisabled = reconciling || (!purchaseAvailable && !syncRequired);

  return <View testID="premium-native-screen" style={[styles.screen, { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 10) }]}>
    <StatusBar style="light" />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={!onBack} onPress={onBack} style={({ pressed }) => [styles.back, { opacity: onBack ? pressed ? 0.65 : 1 : 0 }]}><Text selectable={false} style={styles.backText}>‹</Text></Pressable>
      <Text selectable style={styles.headerTitle}>Formie plans</Text>
      <View style={styles.headerSpacer} />
    </View>

    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View testID="premium-pro-card" style={styles.planCard}>
        <Image testID="premium-pro-card-art" source={cardBackground} contentFit="cover" style={StyleSheet.absoluteFillObject} />
        <View style={styles.planCardShade} />
        <View style={styles.planCopy}>
          <View style={styles.badge}><Text selectable style={styles.badgeStar}>★</Text><Text selectable style={styles.badgeText}>Most popular</Text></View>
          <Text selectable style={styles.planName}>Pro</Text>
          <View style={styles.priceRow}><Text selectable style={styles.price}>{price}</Text><Text selectable style={styles.period}>/mo</Text></View>
          <Text selectable style={styles.description}>For lifters who want better form, better feedback, and faster progress.</Text>
        </View>
      </View>

      <View testID="premium-social-proof" style={styles.socialProof}>
        <Image accessibilityLabel="Formie lifter community" source={socialProofAvatars} contentFit="contain" style={styles.avatars} />
        <View style={styles.ratingGroup}><Text selectable={false} style={styles.star}>★</Text><Text selectable style={styles.rating}>4.9/5</Text></View>
      </View>

      <View style={styles.unlock}>
        <Text selectable style={styles.unlockTitle}>What you unlock</Text>
        {benefits.map(([eyebrow, copy, glyph]) => <View key={eyebrow} testID={`premium-benefit-${eyebrow.toLowerCase()}`} style={styles.benefit}><View testID={`premium-benefit-icon-${eyebrow.toLowerCase()}`} style={styles.benefitIcon}><Text selectable={false} style={styles.benefitGlyph}>{glyph}</Text></View><View style={styles.benefitCopy}><Text selectable style={styles.benefitEyebrow}>{eyebrow}</Text><Text selectable style={styles.benefitText}>{copy}</Text></View></View>)}
      </View>

      <Text selectable style={styles.legal}>Cancel anytime in your Apple or Google subscription settings. Access continues through the paid period. Unused analyses do not carry over.</Text>
      {error ? <Text selectable accessibilityRole="alert" style={styles.error}>{error}</Text> : <View style={styles.errorSpace} />}
    </ScrollView>

    <Pressable testID="onboarding-bottom-cta" accessibilityRole="button" accessibilityLabel={ctaLabel} accessibilityState={{ disabled: ctaDisabled }} disabled={ctaDisabled} onPress={purchase} style={({ pressed }) => [styles.cta, { opacity: ctaDisabled ? 0.45 : pressed ? 0.82 : 1 }]}>{reconciling ? <ActivityIndicator color="#080808" /> : null}<Text selectable={false} style={styles.ctaText}>{ctaLabel}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#050505", paddingHorizontal: 10, gap: 10 },
  header: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, borderCurve: "continuous", borderWidth: 1, borderColor: "#292929", backgroundColor: "#111111" },
  backText: { color: "#F3F1EC", fontSize: 30, lineHeight: 32, marginTop: -2 },
  headerTitle: { color: "#F5F3EF", fontSize: 17, fontWeight: "800" },
  headerSpacer: { width: 38 },
  scrollContent: { gap: 12, paddingVertical: 4, paddingBottom: 18 },
  planCard: { minHeight: 245, overflow: "hidden", borderRadius: 7, borderCurve: "continuous", backgroundColor: "#C99223" },
  planCardShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(63, 31, 0, 0.12)" },
  planCopy: { width: "68%", minHeight: 245, padding: 18, gap: 6 },
  badge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(255,248,222,0.82)" },
  badgeStar: { color: "#302006", fontSize: 12 },
  badgeText: { color: "#302006", fontSize: 11, fontWeight: "800" },
  planName: { color: "#080808", fontSize: 34, lineHeight: 37, fontWeight: "900", marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "flex-end" },
  price: { color: "#080808", fontSize: 38, lineHeight: 42, fontWeight: "900", fontVariant: ["tabular-nums"] },
  period: { color: "#2D210D", fontSize: 14, fontWeight: "800", paddingBottom: 6, paddingLeft: 4 },
  description: { color: "#352409", fontSize: 14, lineHeight: 20, fontWeight: "600", marginTop: 2 },
  socialProof: { minHeight: 74, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, borderRadius: 6, borderCurve: "continuous", borderWidth: 1, borderColor: "#292929", backgroundColor: "#101010", paddingHorizontal: 12, paddingVertical: 8 },
  avatars: { width: 142, height: 54 },
  ratingGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  star: { color: "#F3C250", fontSize: 16 },
  rating: { color: "#F3C250", fontSize: 14, fontWeight: "800" },
  unlock: { gap: 0 },
  unlockTitle: { color: "#F3F1EC", fontSize: 14, fontWeight: "800", paddingBottom: 3 },
  benefit: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 15, borderTopWidth: 1, borderTopColor: "#292929" },
  benefitIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#D9A536" },
  benefitGlyph: { color: "#E7B33C", fontSize: 23, lineHeight: 25, fontWeight: "800" },
  benefitCopy: { flex: 1, gap: 2 },
  benefitEyebrow: { color: "#B4882F", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  benefitText: { color: "#E8E4DB", fontSize: 14, lineHeight: 19 },
  legal: { color: "#85827C", fontSize: 9.5, lineHeight: 14, textAlign: "center", paddingHorizontal: 12 },
  error: { minHeight: 18, color: "#FF8A82", fontSize: 12, textAlign: "center" },
  errorSpace: { minHeight: 18 },
  cta: { minHeight: 53, flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center", borderRadius: 6, borderCurve: "continuous", backgroundColor: theme.colors.gold, paddingHorizontal: 16 },
  ctaText: { color: "#080808", fontSize: 14, fontWeight: "900" },
});
