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
const referencePaywall = require("../../../assets/production/paywall/reference/paywall-reference-latest.png");

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
    "Upgrade to Formie Pro",
    "AI form analysis for serious lifters",
    "Most popular",
    "Pro, " + price + " per month",
    "Cancel anytime",
    "10 analyses every month",
    "AI Form Analysis",
    "Personalized Feedback",
    "Progress Tracking",
    "Formie Coach",
    "Continue with Pro",
    "Secure payment",
    "Trusted by 1,000+ lifters",
    "Real progress. Real results.",
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
  backHotspot: { position: "absolute", left: "3%", top: "5%", width: "12%", height: "7%", backgroundColor: "transparent" },
  ctaHotspot: { position: "absolute", left: "8%", right: "8%", top: "69%", height: "7%", backgroundColor: "transparent" },
  busyIndicator: { position: "absolute", right: "18%", top: "71%" },
  error: { position: "absolute", left: "10%", right: "10%", top: "65%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, color: "#FF8A82", backgroundColor: "rgba(0,0,0,0.88)", textAlign: "center", fontSize: 13, lineHeight: 18 },
});
