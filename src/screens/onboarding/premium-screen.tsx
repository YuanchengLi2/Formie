import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import type { PurchaseState } from "@/features/billing/types";
import { colors } from "@/theme/colors";

export type PremiumScreenProps = {
  price: string;
  purchaseAvailable: boolean;
  busy: boolean;
  state?: PurchaseState;
  error?: string | null;
  restoreMessage?: string | null;
  onBack?: () => void;
  onPurchase: () => void;
  onPurchasePlan?: (plan: "monthly") => void;
  onRetrySync?: () => void;
  onRestore: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
};

const benefits = [
  "10 analyses per month",
  "Evidence-linked corrections",
  "Saved analyses",
  "Progress over time",
] as const;

export function PremiumScreen({ price, purchaseAvailable, busy, state = "idle", error, restoreMessage, onBack, onPurchase, onPurchasePlan, onRetrySync, onRestore, onOpenTerms, onOpenPrivacy }: PremiumScreenProps) {
  const insets = useSafeAreaInsets();
  const reconciling = busy || state === "purchasing" || state === "reconciling";
  const restoring = state === "restoring";
  const storeBusy = reconciling || restoring;
  const syncRequired = state === "sync_required";
  const ctaLabel = !purchaseAvailable && !syncRequired ? "Monthly plan unavailable" : syncRequired ? "Check purchase" : reconciling ? "Starting..." : `Start monthly - ${price}/mo`;
  const visibleCtaLabel = !purchaseAvailable && !syncRequired ? "Plan unavailable" : syncRequired ? "Check purchase" : reconciling ? "Starting..." : "Start Formie Monthly";
  const ctaDisabled = storeBusy || (!purchaseAvailable && !syncRequired);
  const purchase = () => {
    if (syncRequired) return void onRetrySync?.();
    if (onPurchasePlan) onPurchasePlan("monthly");
    else onPurchase();
  };

  return <View testID="premium-native-screen" style={styles.screen}>
    <StatusBar style="light" />
    <ScrollView testID="premium-scroll" contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled: !onBack }} disabled={!onBack} onPress={onBack} hitSlop={12} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
        <Text style={styles.wordmark}>FORMIE</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.hero}>
        <View style={styles.proBadge}><Text style={styles.proBadgeText}>FORMIE PRO</Text></View>
        <Text accessibilityRole="header" style={styles.title}>Train with clearer feedback.</Text>
        <Text style={styles.subtitle}>Review each set, understand the priority correction, and carry one useful cue into the next set.</Text>
      </View>

      <View style={styles.offerCard}>
        <View style={styles.priceRow}>
          <View style={{ flex: 1, gap: 4 }}><Text style={styles.planTitle}>Formie Monthly</Text><Text style={styles.planDetail}>10 new analyses each billing month</Text></View>
          <Text style={styles.price}>{purchaseAvailable ? `${price} per month` : "Monthly plan unavailable"}</Text>
        </View>
        <View style={styles.rule} />
        <View style={styles.benefits}>{benefits.map((benefit) => <View key={benefit} style={styles.benefitRow}><View style={styles.check}><Text style={styles.checkText}>✓</Text></View><Text style={styles.benefitText}>{benefit}</Text></View>)}</View>
      </View>

      {error ? <Text accessibilityRole="alert" selectable style={styles.error}>{error}</Text> : null}
      <Pressable testID="onboarding-bottom-cta" accessibilityRole="button" accessibilityLabel={ctaLabel} accessibilityState={{ disabled: ctaDisabled }} disabled={ctaDisabled} onPress={purchase} style={({ pressed }) => [styles.cta, pressed && !ctaDisabled && styles.pressed, ctaDisabled && styles.disabled]}>
        <Text style={styles.ctaText}>{visibleCtaLabel}</Text>
        {reconciling ? <ActivityIndicator accessibilityLabel="Starting purchase" color="#080808" /> : <Text style={styles.ctaArrow}>→</Text>}
      </Pressable>
      <Text style={styles.renewalDisclosure}>Payment is charged to your Apple ID. The subscription automatically renews each month until cancelled at least 24 hours before the end of the current period. Manage or cancel it in Apple subscription settings.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Restore Purchases" accessibilityState={{ disabled: storeBusy }} disabled={storeBusy} onPress={onRestore} style={({ pressed }) => [styles.restore, pressed && !storeBusy && styles.pressed, storeBusy && styles.disabled]}><Text style={styles.restoreText}>{restoring ? "Restoring..." : "Restore Purchases"}</Text></Pressable>
      {restoreMessage ? <Text accessibilityLiveRegion="polite" style={styles.restoreMessage}>{restoreMessage}</Text> : null}
      <View style={styles.legalRow}><Pressable accessibilityRole="link" accessibilityLabel="Terms of Use" onPress={onOpenTerms} hitSlop={8}><Text style={styles.legalText}>Terms of Use</Text></Pressable><Text style={styles.legalSeparator}>•</Text><Pressable accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={onOpenPrivacy} hitSlop={8}><Text style={styles.legalText}>Privacy Policy</Text></Pressable></View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#050505" }, scroll: { flex: 1 }, content: { width: "100%", maxWidth: 520, alignSelf: "center", paddingHorizontal: 22, gap: 18 },
  topRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, backText: { color: colors.text, fontSize: 40, lineHeight: 42, fontWeight: "300" }, wordmark: { color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: "800", letterSpacing: 3 },
  hero: { alignItems: "center", gap: 11, paddingVertical: 10 }, proBadge: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldSoft }, proBadgeText: { color: colors.gold, fontSize: 11, lineHeight: 14, fontWeight: "800", letterSpacing: 1.4 }, title: { maxWidth: 390, color: colors.text, fontSize: 35, lineHeight: 40, fontWeight: "700", letterSpacing: -1.1, textAlign: "center" }, subtitle: { maxWidth: 410, color: colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: "center" },
  offerCard: { gap: 17, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: "rgba(200,169,107,0.42)", backgroundColor: "rgba(19,18,15,0.96)" }, priceRow: { flexDirection: "row", alignItems: "center", gap: 14 }, planTitle: { color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: "700" }, planDetail: { color: colors.textMuted, fontSize: 11.5, lineHeight: 16 }, price: { maxWidth: 150, color: colors.gold, fontSize: 15, lineHeight: 20, fontWeight: "800", textAlign: "right" }, rule: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.12)" }, benefits: { gap: 13 }, benefitRow: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 11 }, check: { width: 25, height: 25, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.goldSoft }, checkText: { color: colors.gold, fontSize: 14, fontWeight: "900" }, benefitText: { flex: 1, color: colors.text, fontSize: 14.5, lineHeight: 20, fontWeight: "600" },
  cta: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, borderRadius: 15, backgroundColor: colors.gold }, ctaText: { color: "#080808", fontSize: 17, lineHeight: 22, fontWeight: "800" }, ctaArrow: { color: "#080808", fontSize: 27, lineHeight: 30 }, renewalDisclosure: { color: colors.textMuted, fontSize: 11.5, lineHeight: 17, textAlign: "center" }, restore: { minHeight: 44, alignItems: "center", justifyContent: "center" }, restoreText: { color: colors.gold, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" }, restoreMessage: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, textAlign: "center" }, legalRow: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, legalText: { color: colors.textSecondary, fontSize: 12.5, textDecorationLine: "underline" }, legalSeparator: { color: colors.textMuted }, error: { paddingHorizontal: 12, color: colors.danger, fontSize: 13, lineHeight: 18, textAlign: "center" }, pressed: { opacity: 0.76 }, disabled: { opacity: 0.5 },
});
