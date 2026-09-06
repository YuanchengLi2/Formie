import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
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
  restoredSubscription?: boolean;
  onContinue?: () => void;
  referralOffer?: "eligible" | "syncing" | null;
};

const referencePaywall = require("../../../assets/production/paywall/reference/paywall-reference-no-social-proof.png");
const goldGradient = require("../../../assets/production/onboarding/gold-gradient.png");

const PAYWALL_SOURCE_WIDTH = 852;
const PAYWALL_SOURCE_HEIGHT = 1846;
const PAYWALL_CROP_SOURCE_END_Y = 1605;
const PAYWALL_SCROLL_BREATHING_ROOM = 24;
const STATUS_BAR_SOURCE_HEIGHT = 76;
const CTA_SOURCE_FRAME = { x: 74, y: 1328, width: 704, height: 105 };
const PRICE_SOURCE_FRAME = { x: 73, y: 557, width: 405, height: 112 };
const BACK_SOURCE_FRAME = { x: 36, y: 108, size: 82 };

export function getPremiumArtworkLayout(windowWidth: number, windowHeight: number) {
  const contentWidth = Math.min(windowWidth, 480);
  const sourceScale = contentWidth / PAYWALL_SOURCE_WIDTH;
  const imageWidth = contentWidth;
  const imageHeight = PAYWALL_SOURCE_HEIGHT * sourceScale;
  const cropHeight = PAYWALL_CROP_SOURCE_END_Y * sourceScale;

  return {
    contentWidth,
    imageWidth,
    imageHeight,
    cropHeight,
    cropSourceEndY: PAYWALL_CROP_SOURCE_END_Y,
    contentMinHeight: cropHeight + PAYWALL_SCROLL_BREATHING_ROOM,
    statusMaskHeight: STATUS_BAR_SOURCE_HEIGHT * sourceScale,
    cta: {
      left: CTA_SOURCE_FRAME.x * sourceScale,
      top: CTA_SOURCE_FRAME.y * sourceScale,
      width: CTA_SOURCE_FRAME.width * sourceScale,
      height: 60,
    },
    price: {
      left: PRICE_SOURCE_FRAME.x * sourceScale,
      top: PRICE_SOURCE_FRAME.y * sourceScale,
      width: PRICE_SOURCE_FRAME.width * sourceScale,
      height: PRICE_SOURCE_FRAME.height * sourceScale,
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
  restoredSubscription = false,
  onContinue,
  referralOffer = null,
}: PremiumScreenProps) {
  const { width, height } = useWindowDimensions();
  const layout = getPremiumArtworkLayout(width, height);
  const reconciling = busy || state === "purchasing" || state === "reconciling";
  const restoring = state === "restoring";
  const storeBusy = reconciling || restoring;
  const syncRequired = state === "sync_required";
  const ctaLabel = restoredSubscription
    ? "Continue to Formie"
    : !purchaseAvailable && !syncRequired
    ? "Monthly plan unavailable"
    : syncRequired
      ? "Check purchase"
      : reconciling
        ? "Starting..."
        : `Start monthly - ${price}/mo`;
  const visibleCtaLabel = restoredSubscription
    ? "Continue to Formie"
    : !purchaseAvailable && !syncRequired
    ? "Plan unavailable"
    : syncRequired
      ? "Check purchase"
      : reconciling
        ? "Starting..."
        : "Continue with Pro";
  const ctaDisabled = storeBusy || (!restoredSubscription && !purchaseAvailable && !syncRequired);
  const purchase = () => {
    if (restoredSubscription) {
      onContinue?.();
      return;
    }
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
        bounces={false}
        alwaysBounceVertical={false}
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
          <View testID="premium-live-price" style={[styles.priceCover, { left: layout.price.left, top: layout.price.top, width: layout.price.width, height: layout.price.height }]}>
            <Text accessibilityLabel={purchaseAvailable ? `${price} per month` : "Monthly plan unavailable"} style={styles.priceText}>{purchaseAvailable ? price : "Unavailable"}</Text>
            {purchaseAvailable ? <Text style={styles.pricePeriod}>/month</Text> : null}
          </View>
          <View pointerEvents="none" style={styles.accessibilityCopy}>
            <Text accessibilityRole="header">Formie Pro</Text>
            <Text>{purchaseAvailable ? `${price} per month` : "Monthly plan unavailable"}</Text>
            <Text>{referralOffer ? "13 analyses in your first month. 10 analyses every month after." : "10 analyses every month"}</Text>
          </View>
          {referralOffer ? <View accessibilityLiveRegion="polite" style={styles.referralOffer}>
            <Text style={styles.referralOfferTitle}>{referralOffer === "syncing" ? "Your referral bonus is syncing" : "13 analyses in your first month"}</Text>
            <Text style={styles.referralOfferDetail}>10 analyses every month after</Text>
          </View> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            accessibilityState={{ disabled: !onBack }}
            disabled={!onBack}
            onPress={onBack}
            hitSlop={12}
            style={[styles.backButton, { left: layout.back.left, top: layout.back.top, width: layout.back.size, height: layout.back.size }]}
          />
          {restoredSubscription ? <Text accessibilityLiveRegion="polite" style={[styles.restoredMessage, { top: Math.max(0, layout.cta.top - 62) }]}>Your Apple subscription is active</Text> : null}
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
            <Image accessibilityElementsHidden pointerEvents="none" source={goldGradient} contentFit="fill" style={StyleSheet.absoluteFill} />
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
  priceCover: { position: "absolute", zIndex: 3, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 7, backgroundColor: "#0B0B09" },
  priceText: { color: "#FFFFFF", fontSize: 30, lineHeight: 36, fontWeight: "800" },
  pricePeriod: { color: "#E5AD32", fontSize: 15, lineHeight: 20, fontWeight: "800", alignSelf: "flex-end", marginBottom: 12 },
  accessibilityCopy: { position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" },
  referralOffer: { position: "absolute", zIndex: 4, top: "39%", left: "9%", right: "9%", paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: "#8B6823", borderRadius: 12, backgroundColor: "rgba(10,10,9,0.94)", alignItems: "center" },
  referralOfferTitle: { color: "#F4E1A7", fontSize: 16, lineHeight: 21, fontWeight: "800" },
  referralOfferDetail: { color: "#C8C3B9", fontSize: 13, lineHeight: 18 },
  backButton: { position: "absolute", zIndex: 3, borderRadius: 99, backgroundColor: "transparent" },
  complianceFooter: { paddingHorizontal: 28, paddingTop: 14, gap: 8, backgroundColor: "#000000" },
  renewalDisclosure: { color: "#AAA69E", fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  error: { position: "absolute", zIndex: 4, left: "9%", right: "9%", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, color: "#FF8A82", backgroundColor: "rgba(0,0,0,0.92)", textAlign: "center", fontSize: 13, lineHeight: 18 },
  restoredMessage: { position: "absolute", zIndex: 4, left: "9%", right: "9%", paddingHorizontal: 12, color: "#F4E1A7", backgroundColor: "#000000", textAlign: "center", fontSize: 15, lineHeight: 20, fontWeight: "700" },
  cta: { position: "absolute", zIndex: 3, justifyContent: "center", borderRadius: 14, borderCurve: "continuous", overflow: "hidden" },
  ctaPressed: { opacity: 1, transform: [{ scale: 0.985 }] },
  ctaContent: { flex: 1, minHeight: 60, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
