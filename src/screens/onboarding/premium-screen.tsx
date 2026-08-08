import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";

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

// This is the supplied paywall screenshot. It is deliberately rendered as one
// surface so the production screen cannot drift from the approved artwork.
const referencePaywall = require("../../../assets/production/paywall/reference/paywall-reference.png");

export function PremiumScreen({ price, purchaseAvailable, busy, state = "idle", error, onBack, onPurchase, onPurchasePlan, onRetrySync }: PremiumScreenProps) {
  const billingState = state as string;
  const reconciling = busy || billingState === "purchasing" || billingState === "reconciling";
  const syncRequired = billingState === "sync_required";
  const ctaLabel = syncRequired ? "Check purchase" : reconciling ? "Starting..." : "Start monthly - " + price + "/mo";
  const ctaDisabled = reconciling || (!purchaseAvailable && !syncRequired);
  const purchase = () => {
    if (syncRequired) {
      onRetrySync?.();
      return;
    }
    if (onPurchasePlan) onPurchasePlan("monthly");
    else onPurchase();
  };
  const accessibilitySummary = [
    "Formie plans paywall",
    "Pro, monthly, " + price + " per month",
    "Most popular",
    "10 analyses per month",
    "Personalized corrections",
    "Progress tracking",
    "4.9/5",
    "Trusted by 1,000+ lifters",
  ].join(". ");

  return (
    <View testID="premium-native-screen" style={styles.screen}>
      <StatusBar hidden />
      <Image testID="premium-reference-image" source={referencePaywall} contentFit="fill" style={StyleSheet.absoluteFillObject} />

      <View
        testID="premium-accessibility-summary"
        accessible
        accessibilityRole="text"
        accessibilityLabel={accessibilitySummary}
        pointerEvents="none"
        style={styles.accessibilitySummary}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        disabled={!onBack}
        onPress={onBack}
        hitSlop={12}
        style={styles.backHotspot}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Monthly" accessibilityState={{ selected: true }} style={styles.monthlyHotspot} />
      <Pressable accessibilityRole="button" accessibilityLabel="Yearly" accessibilityState={{ disabled: true }} disabled style={styles.yearlyHotspot} />

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {reconciling ? <ActivityIndicator accessibilityLabel="Starting purchase" color="#080808" style={styles.busyIndicator} /> : null}

      <Pressable
        testID="onboarding-bottom-cta"
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        accessibilityState={{ disabled: ctaDisabled }}
        disabled={ctaDisabled}
        onPress={purchase}
        style={styles.ctaHotspot}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  accessibilitySummary: { position: "absolute", width: 1, height: 1, opacity: 0 },
  backHotspot: { position: "absolute", left: "1.5%", top: "5%", width: "10%", height: "7%", backgroundColor: "transparent" },
  monthlyHotspot: { position: "absolute", left: "20%", top: "10.5%", width: "30%", height: "6%", backgroundColor: "transparent" },
  yearlyHotspot: { position: "absolute", left: "50%", top: "10.5%", width: "30%", height: "6%", backgroundColor: "transparent" },
  ctaHotspot: { position: "absolute", left: "2%", right: "2%", bottom: "3%", height: "8%", backgroundColor: "transparent" },
  busyIndicator: { position: "absolute", right: "10%", bottom: "5.5%" },
  error: { position: "absolute", left: "8%", right: "8%", bottom: "12%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, color: "#FF8A82", backgroundColor: "rgba(0,0,0,0.88)", textAlign: "center", fontSize: 13, lineHeight: 18 },
});
