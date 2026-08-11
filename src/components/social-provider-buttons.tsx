import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import type { ReactNode } from "react";
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
  void onEmail;
  const unavailable = disabled || busyProvider !== null;
  const appleLabel = "Sign in with Apple";
  const googleLabel = "Sign in with Google";
  const emailLabel = mode === "onboarding" ? "Continue with email" : "Sign in with Email";
  return <View testID="social-provider-buttons" style={styles.actions}>
    <Pressable testID="provider-apple" accessibilityLabel={appleLabel} accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={() => onOAuth("apple")} style={({ pressed }) => [styles.provider, styles.apple, (pressed || unavailable) && styles.pressed]}>
      <Image source={appleIcon} contentFit="contain" accessibilityLabel="Apple" style={[styles.icon, styles.appleIcon]} />
      <Text style={styles.appleText}>{busyProvider === "apple" ? "Connecting to Apple…" : appleLabel}</Text>
    </Pressable>
    <UnavailableProvider testID="provider-google" label={googleLabel}>
      <Image source={googleIcon} contentFit="contain" accessibilityLabel="Google" style={styles.icon} />
      <Text style={styles.googleText}>{googleLabel}</Text>
    </UnavailableProvider>
    <UnavailableProvider testID="provider-email" label={emailLabel}>
      <View accessibilityElementsHidden style={styles.emailIcon}><View style={styles.emailFlapLeft} /><View style={styles.emailFlapRight} /></View>
      <Text style={styles.emailText}>{emailLabel}</Text>
    </UnavailableProvider>
  </View>;
}

function UnavailableProvider({ testID, label, children }: { testID: string; label: string; children: ReactNode }) {
  return <View style={styles.unavailableWrap}>
    <Pressable testID={testID} accessibilityLabel={`${label} — Coming soon`} accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={[styles.provider, styles.unavailableProvider]}>{children}</Pressable>
    <BlurView pointerEvents="none" intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>Coming soon</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  actions: { gap: 22 },
  provider: { minHeight: 58, borderRadius: 29, borderCurve: "continuous", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 18, backgroundColor: "#111110", borderWidth: 1, borderColor: "#E5AD32" },
  apple: { backgroundColor: "#E5AD32", borderColor: "#E5AD32" },
  unavailableProvider: { backgroundColor: "#111110", borderColor: "#E5AD32" },
  icon: { width: 22, height: 22 },
  appleIcon: { tintColor: "#080808" },
  appleText: { color: "#080808", fontSize: 16, fontWeight: "700" },
  googleText: { color: "#F5F4F0", fontSize: 16, fontWeight: "600" },
  emailText: { color: "#F5F4F0", fontSize: 16, fontWeight: "600" },
  emailIcon: { width: 24, height: 18, overflow: "hidden", borderRadius: 2, borderWidth: 1.8, borderColor: "#E5AD32" },
  emailFlapLeft: { position: "absolute", top: 2, left: 0, width: 15, height: 1.8, backgroundColor: "#E5AD32", transform: [{ rotate: "32deg" }] },
  emailFlapRight: { position: "absolute", top: 2, right: 0, width: 15, height: 1.8, backgroundColor: "#E5AD32", transform: [{ rotate: "-32deg" }] },
  pressed: { opacity: 0.55 },
  unavailableWrap: { position: "relative", minHeight: 58, overflow: "hidden", borderRadius: 29 },
  comingSoonBadge: { position: "absolute", right: 12, top: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: "rgba(229,173,50,0.95)" },
  comingSoonText: { color: "#080808", fontSize: 10, lineHeight: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
});
