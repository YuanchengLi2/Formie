import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { onboardingTheme as theme } from "@/theme/onboarding";

export type PremiumScreenProps = {
  price: string;
  purchaseAvailable: boolean;
  busy: boolean;
  error?: string | null;
  onPurchase: () => void;
};

const benefits = [
  "10 form analyses per month",
  "First look into new features",
  "Premium support",
  "Complete personalized coaching",
];

export function PremiumScreen({ price, purchaseAvailable, busy, error, onPurchase }: PremiumScreenProps) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const usableHeight = height - insets.top - insets.bottom;
  const short = usableHeight < 650;
  const compact = usableHeight < 800 || width < 360;
  const ctaHeight = short ? theme.layout.short.ctaHeight : compact ? theme.layout.compact.ctaHeight : theme.layout.regular.ctaHeight;
  return <View testID="premium-native-screen" style={[styles.screen, { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 10) }]}>
    <StatusBar hidden />
    <ScrollView style={styles.scroller} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}><View style={[styles.content, compact && styles.contentCompact, short && styles.contentShort]}>
      <View style={styles.heading}><Text style={styles.eyebrow}>FORMIE MONTHLY</Text><Text style={[styles.title, short && styles.titleShort]}>Get the answer after every set.</Text><Text style={[styles.subtitle, short && styles.subtitleShort]}>Personalized feedback from the movement visible in your recording.</Text></View>
      <View testID="premium-upright-card" style={[styles.card, compact && styles.cardCompact, short && styles.cardShort]}>
        <View style={styles.priceRow}><Text style={[styles.price, short && styles.priceShort]}>{price}</Text><Text style={styles.perMonth}> / month</Text></View>
        <Text style={styles.limit}>10 complete analyses each month</Text>
        <View style={styles.benefits}>{benefits.map((benefit) => <View key={benefit} style={[styles.benefit, short && styles.benefitShort]}><View style={styles.check}><Text style={styles.checkText}>✓</Text></View><Text style={[styles.benefitText, short && styles.benefitTextShort]}>{benefit}</Text></View>)}</View>
        <Text style={styles.cancel}>Cancel anytime in your Apple or Google subscription settings. Access continues through your paid period.</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <View style={styles.errorSpace} />}
    </View></ScrollView>
    <View style={styles.actions}>
      <Pressable testID="onboarding-bottom-cta" accessibilityRole="button" accessibilityLabel={busy ? "Starting..." : "Go Now"} accessibilityState={{ disabled: busy || !purchaseAvailable }} disabled={busy || !purchaseAvailable} onPress={onPurchase} style={({ pressed }) => [styles.cta, { height: ctaHeight, opacity: busy || !purchaseAvailable ? 0.5 : pressed ? 0.82 : 1 }]}><View style={styles.ctaBusy}>{busy ? <ActivityIndicator color="#080808" /> : null}<Text style={styles.ctaText}>{busy ? "Starting..." : "Go Now"}</Text></View><Text style={styles.arrow}>→</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 20 }, scroller: { flex: 1, width: "100%" }, scrollContent: { flexGrow: 1, justifyContent: "center", paddingVertical: 8 }, content: { width: "100%", maxWidth: 520, alignSelf: "center", justifyContent: "center", gap: 14 }, contentCompact: { gap: 9 }, contentShort: { gap: 5 },
  heading: { gap: 6 }, eyebrow: { color: theme.colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 2 }, title: { color: theme.colors.text, fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -1 }, titleShort: { fontSize: 25, lineHeight: 28 }, subtitle: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 19 }, subtitleShort: { fontSize: 11, lineHeight: 14 },
  card: { width: "100%", borderRadius: 24, borderWidth: 1.5, borderColor: theme.colors.goldMuted, backgroundColor: "#0B0B0A", padding: 20, gap: 12 }, cardCompact: { padding: 15, gap: 8 }, cardShort: { padding: 10, gap: 5 }, priceRow: { flexDirection: "row", alignItems: "flex-end" }, price: { color: theme.colors.text, fontSize: 48, lineHeight: 52, fontWeight: "800", fontVariant: ["tabular-nums"] }, priceShort: { fontSize: 34, lineHeight: 37 }, perMonth: { color: theme.colors.textMuted, fontSize: 14, paddingBottom: 6 }, limit: { color: theme.colors.gold, fontSize: 13, fontWeight: "700" }, benefits: { gap: 3 }, benefit: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 7 }, benefitShort: { minHeight: 25, paddingTop: 3 }, check: { width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.gold }, checkText: { color: "#080808", fontSize: 12, fontWeight: "900" }, benefitText: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 17 }, benefitTextShort: { fontSize: 10.5, lineHeight: 13 }, cancel: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 14, textAlign: "center" },
  error: { minHeight: 18, color: "#FF7C7C", fontSize: 12, textAlign: "center" }, errorSpace: { minHeight: 18 }, actions: { width: "100%", maxWidth: 520, alignSelf: "center" }, cta: { width: "100%", borderRadius: 15, backgroundColor: theme.colors.gold, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, ctaBusy: { flexDirection: "row", alignItems: "center", gap: 8 }, ctaText: { color: "#080808", fontSize: 19, fontWeight: "800" }, arrow: { color: "#080808", fontSize: 30, lineHeight: 32 },
});
