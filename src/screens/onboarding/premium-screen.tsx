import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";

import type { PurchaseState } from "@/features/billing/types";

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

const referencePaywall = require("../../../assets/production/paywall/reference/paywall-reference-no-social-proof.png");
const goldGradient = require("../../../assets/production/onboarding/gold-gradient.png");

const PAYWALL_SOURCE_WIDTH = 852;
const PAYWALL_SOURCE_HEIGHT = 1846;
const PAYWALL_SCROLL_BREATHING_ROOM = 16;
const STATUS_BAR_SOURCE_HEIGHT = 76;
const CTA_SOURCE_FRAME = { x: 74, y: 1640, width: 704, height: 105 };
const BACK_SOURCE_FRAME = { x: 36, y: 108, size: 82 };

export function getPremiumArtworkLayout(windowWidth: number, windowHeight: number) {
  const contentWidth = Math.min(windowWidth, 480);
  const sourceScale = contentWidth / PAYWALL_SOURCE_WIDTH;
  const imageWidth = contentWidth;
  const imageHeight = PAYWALL_SOURCE_HEIGHT * sourceScale;
  const cropHeight = Math.max(windowHeight, imageHeight);

  return {
    contentWidth,
    imageWidth,
    imageHeight,
    cropHeight,
    cropSourceEndY: PAYWALL_SOURCE_HEIGHT,
    contentMinHeight: cropHeight + PAYWALL_SCROLL_BREATHING_ROOM,
    statusMaskHeight: STATUS_BAR_SOURCE_HEIGHT * sourceScale,
    cta: {
      left: CTA_SOURCE_FRAME.x * sourceScale,
      top: CTA_SOURCE_FRAME.y * sourceScale,
      width: CTA_SOURCE_FRAME.width * sourceScale,
      height: 56,
    },
    back: {
      left: BACK_SOURCE_FRAME.x * sourceScale,
      top: BACK_SOURCE_FRAME.y * sourceScale,
      size: Math.max(52, BACK_SOURCE_FRAME.size * sourceScale),
    },
  };
}

export function PremiumScreen({
  price,
  purchaseAvailable,
  busy,
  state = "idle",
  error,
  restoreMessage,
  onBack,
  onPurchase,
  onPurchasePlan,
  onRetrySync,
  onRestore,
  onOpenTerms,
  onOpenPrivacy,
}: PremiumScreenProps) {
  const { width, height } = useWindowDimensions();
  const layout = getPremiumArtworkLayout(width, height);
  const reconciling = busy || state === "purchasing" || state === "reconciling";
  const restoring = state === "restoring";
  const storeBusy = reconciling || restoring;
  const syncRequired = state === "sync_required";
  const ctaLabel = !purchaseAvailable && !syncRequired
    ? "Monthly plan unavailable"
    : syncRequired
      ? "Check purchase"
      : reconciling
        ? "Starting..."
        : `Start monthly - ${price}/mo`;
  const visibleCtaLabel = !purchaseAvailable && !syncRequired
    ? "Plan unavailable"
    : syncRequired
      ? "Check purchase"
      : reconciling
        ? "Starting..."
        : "Continue with Pro";
  const ctaDisabled = storeBusy || (!purchaseAvailable && !syncRequired);
  const purchase = () => {
    if (syncRequired) {
      onRetrySync?.();
      return;
    }
    if (onPurchasePlan) onPurchasePlan("monthly");
    else onPurchase();
  };
  return (
    <View testID="premium-native-screen" style={styles.screen}>
      <StatusBar hidden />
      <ScrollView
        testID="premium-scroll"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { minHeight: layout.contentMinHeight }]}
      >
        <View style={[styles.artworkCrop, { width: layout.contentWidth, height: layout.cropHeight }]}>
          <Image
            testID="premium-reference-image"
            accessibilityElementsHidden
            source={referencePaywall}
            contentFit="fill"
            contentPosition="top"
            style={[styles.referenceImage, { width: layout.imageWidth, height: layout.imageHeight }]}
          />
          <View testID="premium-status-mask" pointerEvents="none" style={[styles.statusMask, { height: layout.statusMaskHeight }]} />
          <View pointerEvents="none" style={styles.accessibilityCopy}>
            <Text accessibilityRole="header">Formie Pro</Text>
            <Text>{purchaseAvailable ? `${price} per month` : "Monthly plan unavailable"}</Text>
            <Text>10 analyses every month</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityState={{ disabled: !onBack }}
            disabled={!onBack}
            onPress={onBack}
            hitSlop={12}
            style={[styles.backButton, { left: layout.back.left, top: layout.back.top, width: layout.back.size, height: layout.back.size }]}
          />
          {error ? <Text accessibilityRole="alert" selectable style={[styles.error, { top: Math.max(0, layout.cta.top - 58) }]}>{error}</Text> : null}
          <Pressable
            testID="onboarding-bottom-cta"
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            accessibilityState={{ disabled: ctaDisabled }}
            disabled={ctaDisabled}
            onPress={purchase}
            style={({ pressed }) => [
              styles.cta,
              { left: layout.cta.left, top: layout.cta.top, width: layout.cta.width, height: layout.cta.height, minHeight: layout.cta.height },
              pressed && !ctaDisabled && styles.ctaPressed,
            ]}
          >
            <Image accessibilityElementsHidden pointerEvents="none" source={goldGradient} contentFit="fill" style={StyleSheet.absoluteFillObject} />
            <View style={styles.ctaContent}>
              <Text style={styles.ctaText}>{visibleCtaLabel}</Text>
              {reconciling ? <ActivityIndicator accessibilityLabel="Starting purchase" color="#080808" /> : <Text style={styles.ctaArrow}>→</Text>}
            </View>
          </Pressable>
        </View>

        <View style={[styles.complianceFooter, { width: layout.contentWidth }]}>
          <Text style={styles.renewalDisclosure}>
            Payment is charged to your Apple ID. The subscription automatically renews each month until cancelled at least 24 hours before the end of the current period. Manage or cancel it in Apple subscription settings.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Restore Purchases" accessibilityState={{ disabled: storeBusy }} disabled={storeBusy} onPress={onRestore} style={({ pressed }) => [styles.restore, pressed && !storeBusy && styles.pressed, storeBusy && styles.disabled]}>
            <Text style={styles.restoreText}>{restoring ? "Restoring..." : "Restore Purchases"}</Text>
          </Pressable>
          {restoreMessage ? <Text accessibilityLiveRegion="polite" style={styles.restoreMessage}>{restoreMessage}</Text> : null}
          <View style={styles.legalRow}>
            <Pressable accessibilityRole="link" accessibilityLabel="Terms of Use" onPress={onOpenTerms} hitSlop={8}><Text style={styles.legalText}>Terms of Use</Text></Pressable>
            <Text style={styles.legalSeparator}>•</Text>
            <Pressable accessibilityRole="link" accessibilityLabel="Privacy Policy" onPress={onOpenPrivacy} hitSlop={8}><Text style={styles.legalText}>Privacy Policy</Text></Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  scroll: { flex: 1, width: "100%" },
  scrollContent: { alignItems: "center", backgroundColor: "#000000", paddingBottom: 28 },
  artworkCrop: { position: "relative", overflow: "hidden", backgroundColor: "#000000" },
  referenceImage: { position: "absolute", left: 0, top: 0 },
  statusMask: { position: "absolute", zIndex: 2, top: 0, left: 0, right: 0, backgroundColor: "#000000" },
  accessibilityCopy: { position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" },
  backButton: { position: "absolute", zIndex: 3, borderRadius: 99, backgroundColor: "transparent" },
  complianceFooter: { paddingHorizontal: 28, paddingTop: 14, gap: 8, backgroundColor: "#000000" },
  renewalDisclosure: { color: "#AAA69E", fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  error: { position: "absolute", zIndex: 4, left: "9%", right: "9%", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, color: "#FF8A82", backgroundColor: "rgba(0,0,0,0.92)", textAlign: "center", fontSize: 13, lineHeight: 18 },
  cta: { position: "absolute", zIndex: 3, justifyContent: "center", borderRadius: 14, borderCurve: "continuous", overflow: "hidden" },
  ctaPressed: { opacity: 1, transform: [{ scale: 0.985 }] },
  ctaContent: { flex: 1, minHeight: 56, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ctaText: { color: "#070707", fontSize: 18, lineHeight: 22, fontWeight: "800" },
  ctaArrow: { color: "#070707", fontSize: 28, lineHeight: 31 },
  restore: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  restoreText: { color: "#E5AD32", fontSize: 15, fontWeight: "700", textDecorationLine: "underline" },
  restoreMessage: { color: "#D8D3C8", fontSize: 13, lineHeight: 18, textAlign: "center" },
  legalRow: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  legalText: { color: "#C8C3B9", fontSize: 12.5, textDecorationLine: "underline" },
  legalSeparator: { color: "#706D67", fontSize: 12 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
