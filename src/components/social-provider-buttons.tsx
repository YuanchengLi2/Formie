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
  const appleLabel = "Sign in with Apple";
  const googleLabel = "Sign in with Google";
  const emailLabel = mode === "onboarding" ? "Continue with email" : "Sign in with Email";
  return <View testID="social-provider-buttons" style={styles.actions}>
    <Pressable testID="provider-apple" accessibilityLabel={appleLabel} accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={() => onOAuth("apple")} style={({ pressed }) => [styles.provider, (pressed || unavailable) && styles.pressed]}>
      <Image source={appleIcon} contentFit="contain" accessibilityLabel="Apple" style={[styles.icon, styles.appleIcon]} />
      <Text style={styles.appleText}>{busyProvider === "apple" ? "Connecting to Apple…" : appleLabel}</Text>
    </Pressable>
    <Pressable testID="provider-google" accessibilityLabel={googleLabel} accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={() => onOAuth("google")} style={({ pressed }) => [styles.provider, styles.google, (pressed || unavailable) && styles.pressed]}>
      <Image source={googleIcon} contentFit="contain" accessibilityLabel="Google" style={styles.icon} />
      <Text style={styles.googleText}>{busyProvider === "google" ? "Connecting to Google…" : googleLabel}</Text>
    </Pressable>
    <Pressable testID="provider-email" accessibilityLabel={emailLabel} accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={onEmail} style={({ pressed }) => [styles.provider, styles.email, (pressed || unavailable) && styles.pressed]}>
      <View accessibilityElementsHidden style={styles.emailIcon}><View style={styles.emailFlapLeft} /><View style={styles.emailFlapRight} /></View>
      <Text style={styles.emailText}>{emailLabel}</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  actions: { gap: 22 },
  provider: { minHeight: 58, borderRadius: 29, borderCurve: "continuous", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 18, backgroundColor: "#000000" },
  google: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8D8E0" },
  email: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8D8E0" },
  icon: { width: 22, height: 22 },
  appleIcon: { tintColor: "#FFFFFF" },
  appleText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  googleText: { color: "#202027", fontSize: 16, fontWeight: "600" },
  emailText: { color: "#202027", fontSize: 16, fontWeight: "600" },
  emailIcon: { width: 24, height: 18, overflow: "hidden", borderRadius: 2, borderWidth: 1.8, borderColor: "#303038" },
  emailFlapLeft: { position: "absolute", top: 2, left: 0, width: 15, height: 1.8, backgroundColor: "#303038", transform: [{ rotate: "32deg" }] },
  emailFlapRight: { position: "absolute", top: 2, right: 0, width: 15, height: 1.8, backgroundColor: "#303038", transform: [{ rotate: "-32deg" }] },
  pressed: { opacity: 0.55 },
});
