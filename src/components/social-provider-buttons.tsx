import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SocialProvider } from "@/features/auth/auth-service";

const appleIcon = require("../../assets/production/onboarding/apple-icon.png");

export function SocialProviderButtons({ onOAuth, busyProvider = null, disabled = false }: {
  onOAuth: (provider: "apple") => void;
  busyProvider?: SocialProvider | null;
  disabled?: boolean;
}) {
  const unavailable = disabled || busyProvider !== null;
  const appleLabel = "Sign in with Apple";
  return <View testID="social-provider-buttons" style={styles.actions}>
    <Pressable testID="provider-apple" accessibilityLabel={appleLabel} accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={() => onOAuth("apple")} style={({ pressed }) => [styles.provider, styles.apple, (pressed || unavailable) && styles.pressed]}>
      <Image source={appleIcon} contentFit="contain" accessibilityLabel="Apple" style={[styles.icon, styles.appleIcon]} />
      <Text style={styles.appleText}>{busyProvider === "apple" ? "Connecting to Apple…" : appleLabel}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  actions: { gap: 22 },
  provider: { minHeight: 58, borderRadius: 29, borderCurve: "continuous", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 18, backgroundColor: "#111110", borderWidth: 1, borderColor: "#E5AD32" },
  apple: { backgroundColor: "#E5AD32", borderColor: "#E5AD32" },
  icon: { width: 22, height: 22 },
  appleIcon: { tintColor: "#080808" },
  appleText: { color: "#080808", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.55 },
});
