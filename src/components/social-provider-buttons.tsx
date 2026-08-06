import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SocialProvider } from "@/features/auth/auth-service";

const appleIcon = require("../../assets/production/onboarding/apple-icon.png");
const googleIcon = require("../../assets/production/onboarding/google-icon.png");

export function SocialProviderButtons({ onOAuth, onEmail, mode, busyProvider = null, disabled = false }: {
  onOAuth: (provider: SocialProvider) => void;
  onEmail: () => void;
  mode: "login" | "onboarding";
  busyProvider?: SocialProvider | null;
  disabled?: boolean;
}) {
  const unavailable = disabled || busyProvider !== null;
  const prefix = mode === "onboarding" ? "Save your account with" : "Sign in with";
  return <View testID="social-provider-buttons" style={styles.actions}>
    <Pressable testID="provider-apple" accessibilityLabel={`${prefix} Apple`} accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={() => onOAuth("apple")} style={({ pressed }) => [styles.provider, (pressed || unavailable) && styles.pressed]}>
      <Image source={appleIcon} contentFit="contain" accessibilityLabel="Apple" style={styles.icon} />
      <Text style={styles.appleText}>{busyProvider === "apple" ? "Connecting to Apple…" : `${prefix} Apple`}</Text>
    </Pressable>
    <Pressable testID="provider-google" accessibilityLabel={`${prefix} Google`} accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={() => onOAuth("google")} style={({ pressed }) => [styles.provider, styles.google, (pressed || unavailable) && styles.pressed]}>
      <Image source={googleIcon} contentFit="contain" accessibilityLabel="Google" style={styles.icon} />
      <Text style={styles.googleText}>{busyProvider === "google" ? "Connecting to Google…" : `${prefix} Google`}</Text>
    </Pressable>
    <Pressable testID="provider-email" accessibilityLabel={`${prefix} Email`} accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={onEmail} style={({ pressed }) => [styles.provider, styles.email, (pressed || unavailable) && styles.pressed]}>
      <View accessibilityElementsHidden style={styles.emailIcon}><View style={styles.emailFlapLeft} /><View style={styles.emailFlapRight} /></View>
      <Text style={styles.emailText}>{`${prefix} Email`}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  actions: { gap: 15 },
  provider: { minHeight: 50, borderRadius: 13, borderCurve: "continuous", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11, paddingHorizontal: 16, backgroundColor: "#F7F7F7" },
  google: { backgroundColor: "#050505", borderWidth: 1, borderColor: "#77736E" },
  email: { backgroundColor: "#17130B", borderWidth: 1, borderColor: "#C99A3B" },
  icon: { width: 22, height: 22 },
  appleText: { color: "#080808", fontSize: 16, fontWeight: "700" },
  googleText: { color: "#F7F6F4", fontSize: 16, fontWeight: "700" },
  emailText: { color: "#F6D88C", fontSize: 16, fontWeight: "700" },
  emailIcon: { width: 29, height: 22, overflow: "hidden", borderRadius: 4, borderWidth: 2, borderColor: "#F4B531" },
  emailFlapLeft: { position: "absolute", top: 2, left: 0, width: 18, height: 2, backgroundColor: "#F4B531", transform: [{ rotate: "32deg" }] },
  emailFlapRight: { position: "absolute", top: 2, right: 0, width: 18, height: 2, backgroundColor: "#F4B531", transform: [{ rotate: "-32deg" }] },
  pressed: { opacity: 0.55 },
});
