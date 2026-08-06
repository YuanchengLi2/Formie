import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SocialProviderButtons } from "@/components/social-provider-buttons";
import type { SocialProvider } from "@/features/auth/auth-service";
import { onboardingTheme as theme } from "@/theme/onboarding";

const logo = require("../../assets/images/form-logo-mark.png");

type AccountAccessMode = "login" | "onboarding";

function ConsentRow({ label, checked, onPress, children }: { label: string; checked: boolean; onPress: () => void; children: ReactNode }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}>
    <View testID="account-access-checkbox" style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Text style={styles.check}>✓</Text> : null}</View>
    <Text style={styles.consentText}>{children}</Text>
  </Pressable>;
}

export function AccountAccessScreen({ mode = "login", personalizedMessage, onOAuth, onEmail, onCreateAccount, onOpenTerms, onOpenPrivacy, onPrivacyConsentChange, busyProvider = null, busy = false, error }: {
  mode?: AccountAccessMode;
  personalizedMessage?: string;
  onOAuth: (provider: SocialProvider) => void;
  onEmail: () => void;
  onCreateAccount?: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  onPrivacyConsentChange?: (accepted: boolean) => void;
  busyProvider?: SocialProvider | null;
  busy?: boolean;
  error?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const disabled = busy || busyProvider !== null || !termsAccepted || !privacyAccepted;
  const title = mode === "onboarding" ? "Save your account" : "Welcome back";
  const message = personalizedMessage ?? (mode === "onboarding" ? "Save the coaching profile you just built so your goals, analyses, and progress stay with you." : "Welcome back. Your coaching history is ready when you are.");

  return <View testID="social-account-access" style={styles.screen}>
    <StatusBar style="light" />
    <View style={[styles.safeTop, { height: Math.max(insets.top, 12) }]} /><View testID="account-access-gold-bar" style={styles.goldBar} />
    <ScrollView testID="account-access-scroll" contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>{mode === "onboarding" ? <><Image accessibilityLabel="Formie" source={logo} contentFit="contain" style={styles.logo} /><Text style={styles.eyebrow}>YOUR PROFILE IS READY</Text></> : null}<Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text></View>
      <View style={styles.actions}>
        <SocialProviderButtons mode={mode} disabled={disabled} busyProvider={busyProvider} onOAuth={onOAuth} onEmail={onEmail} />
        {busy && !busyProvider ? <View style={styles.busy}><ActivityIndicator color={theme.colors.gold} /><Text style={styles.busyText}>Connecting…</Text></View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {mode === "login" && onCreateAccount ? <Pressable accessibilityRole="button" onPress={onCreateAccount} style={({ pressed }) => [styles.createAccount, pressed && styles.pressed]}><Text style={styles.createAccountText}>Create New Account</Text></Pressable> : null}
      </View>
      <View style={styles.consents}>
        <ConsentRow label="Agree to the Terms of Use" checked={termsAccepted} onPress={() => setTermsAccepted((value) => !value)}>I agree to the <Text accessibilityRole="link" onPress={onOpenTerms} style={styles.link}>Terms of Use</Text></ConsentRow>
        <ConsentRow label="Acknowledge the Privacy Policy" checked={privacyAccepted} onPress={() => setPrivacyAccepted((value) => { const next = !value; onPrivacyConsentChange?.(next); return next; })}>I acknowledge the <Text accessibilityRole="link" onPress={onOpenPrivacy} style={styles.link}>Privacy Policy</Text></ConsentRow>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#030303" },
  safeTop: { width: "100%", backgroundColor: "#030303" },
  goldBar: { width: "100%", height: 4, backgroundColor: "#D9A83F", boxShadow: "0 2px 10px rgba(244,181,49,0.18)" },
  content: { flexGrow: 1, width: "100%", maxWidth: 520, alignSelf: "center", justifyContent: "center", gap: 22, paddingHorizontal: 24, paddingTop: 14 },
  hero: { alignItems: "center", gap: 10 },
  logo: { width: 82, height: 82, marginBottom: 4 },
  eyebrow: { color: "#F4B531", fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 2.1 },
  title: { color: "#F8F7F5", fontSize: 35, lineHeight: 40, fontWeight: "800", letterSpacing: -1, textAlign: "center" },
  message: { maxWidth: 430, color: "#AAA6A2", fontSize: 15, lineHeight: 22, fontWeight: "500", textAlign: "center" },
  actions: { width: "100%", gap: 15 },
  busy: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  busyText: { color: "#D8D3CC", fontSize: 14 },
  error: { color: "#FF8A8A", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  createAccount: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, borderCurve: "continuous", borderWidth: 1, borderColor: "#4C463B" },
  createAccountText: { color: "#F4B531", fontSize: 17, fontWeight: "800" },
  consents: { gap: 10, paddingTop: 2 },
  consentRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderCurve: "continuous", borderWidth: 1.5, borderColor: "#817B72", alignItems: "center", justifyContent: "center", backgroundColor: "#090909" },
  checkboxChecked: { borderColor: "#F4B531", backgroundColor: "#F4B531" },
  check: { color: "#070707", fontSize: 15, lineHeight: 17, fontWeight: "900" },
  consentText: { flex: 1, color: "#F2EFEB", fontSize: 14, lineHeight: 20 },
  link: { color: "#F4B531", fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
