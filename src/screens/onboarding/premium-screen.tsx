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
  onBack?: () => void;
  onPurchase: () => void;
  onPurchasePlan?: (plan: "monthly") => void;
  onRetrySync?: () => void;
};

const referencePaywall = require("../../../assets/production/paywall/reference/paywall-reference-no-icons-852x1846.png");
const goldGradient = require("../../../assets/production/onboarding/gold-gradient.png");

const PAYWALL_SOURCE_WIDTH = 852;
const PAYWALL_SOURCE_HEIGHT = 1846;
const PAYWALL_SCROLL_BREATHING_ROOM = 16;
const STATUS_BAR_SOURCE_HEIGHT = 76;
const CTA_SOURCE_FRAME = { x: 74, y: 1640, width: 704, height: 105 };
const BACK_SOURCE_FRAME = { x: 36, y: 108, size: 82 };

export function getPremiumArtworkLayout(windowWidth: number, windowHeight: number) {
  const contentWidth = Math.min(windowWidth, 480);
  const imageWidth = contentWidth;
  const sourceScale = imageWidth / PAYWALL_SOURCE_WIDTH;
  const imageHeight = PAYWALL_SOURCE_HEIGHT * sourceScale;
  const cropHeight = Math.max(windowHeight, imageHeight);
  const imageLeft = 0;
  const imageTop = 0;
  const statusMaskHeight = STATUS_BAR_SOURCE_HEIGHT * sourceScale;
  const nativeCtaHeight = 56;
  const cta = {
    left: imageLeft + CTA_SOURCE_FRAME.x * sourceScale,
    top: CTA_SOURCE_FRAME.y * sourceScale,
    width: CTA_SOURCE_FRAME.width * sourceScale,
    height: nativeCtaHeight,
  };
  const back = {
    left: imageLeft + BACK_SOURCE_FRAME.x * sourceScale,
    top: BACK_SOURCE_FRAME.y * sourceScale,
    size: Math.max(52, BACK_SOURCE_FRAME.size * sourceScale),
  };

  return {
    contentWidth,
    imageWidth,
    imageHeight,
    imageLeft,
    imageTop,
    cropHeight,
    topCropSourceY: 0,
    statusMaskHeight,
    cropSourceEndY: PAYWALL_SOURCE_HEIGHT,
    contentMinHeight: cropHeight + PAYWALL_SCROLL_BREATHING_ROOM,
    cta,
    back,
  };
}

export function PremiumScreen({ price, purchaseAvailable, busy, state = "idle", error, onBack, onPurchase, onPurchasePlan, onRetrySync }: PremiumScreenProps) {
  const { width, height } = useWindowDimensions();
  const layout = getPremiumArtworkLayout(width, height);
  const billingState = state as string;
  const reconciling = busy || billingState === "purchasing" || billingState === "reconciling";
  const syncRequired = billingState === "sync_required";
  const ctaLabel = syncRequired ? "Check purchase" : reconciling ? "Starting..." : "Start monthly - " + price + "/mo";
  const visibleCtaLabel = syncRequired ? "Check purchase" : reconciling ? "Starting..." : purchaseAvailable ? "Continue with Pro" : "Plan unavailable";
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
  ].join(". ");

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
            source={referencePaywall}
            contentFit="fill"
            contentPosition="center"
            style={[styles.referenceImage, { left: layout.imageLeft, top: layout.imageTop, width: layout.imageWidth, height: layout.imageHeight }]}
          />

          <View
            testID="premium-status-mask"
            pointerEvents="none"
            style={[styles.statusMask, { height: layout.statusMaskHeight }]}
          />

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
              styles.ctaOverlay,
              { left: layout.cta.left, top: layout.cta.top, width: layout.cta.width, height: layout.cta.height, minHeight: layout.cta.height },
              pressed && !ctaDisabled && styles.ctaPressed,
            ]}
          >
            <>
              <Image accessibilityElementsHidden pointerEvents="none" source={goldGradient} contentFit="fill" style={StyleSheet.absoluteFillObject} />
              <View style={styles.ctaContent}>
                <Text style={styles.ctaText}>{visibleCtaLabel}</Text>
                {reconciling ? <ActivityIndicator accessibilityLabel="Starting purchase" color="#080808" /> : <Text style={styles.ctaArrow}>→</Text>}
              </View>
            </>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  scroll: { flex: 1, width: "100%" },
  scrollContent: { alignItems: "center", backgroundColor: "#000000" },
  artworkCrop: { position: "relative", overflow: "hidden", backgroundColor: "#000000" },
  referenceImage: { position: "absolute" },
  statusMask: { position: "absolute", zIndex: 2, top: 0, left: 0, right: 0, backgroundColor: "#000000" },
  accessibilitySummary: { position: "absolute", width: 1, height: 1, opacity: 0 },
  backButton: { position: "absolute", zIndex: 3, backgroundColor: "transparent" },
  cta: { position: "absolute", zIndex: 3, opacity: 1, justifyContent: "center", borderRadius: 14, borderCurve: "continuous", overflow: "hidden" },
  ctaOverlay: { boxShadow: "0 8px 24px rgba(222, 166, 45, 0.24)" },
  ctaPressed: { opacity: 1, transform: [{ scale: 0.985 }] },
  ctaContent: { flex: 1, minHeight: 56, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ctaText: { color: "#070707", fontSize: 18, lineHeight: 22, fontWeight: "800" },
  ctaArrow: { color: "#070707", fontSize: 28, lineHeight: 31 },
  error: { position: "absolute", zIndex: 3, left: "9%", right: "9%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, color: "#FF8A82", backgroundColor: "rgba(0,0,0,0.92)", textAlign: "center", fontSize: 13, lineHeight: 18 },
});
