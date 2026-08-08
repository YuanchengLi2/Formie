import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SocialProviderButtons } from "@/components/social-provider-buttons";
import type { SocialProvider } from "@/features/auth/auth-service";

type AccountAccessMode = "login" | "onboarding";

function ConsentRow({ label, checked, onPress, children }: { label: string; checked: boolean; onPress: () => void; children: ReactNode }) {
  return <View style={styles.consentRow}>
    <Pressable testID="account-access-checkbox" accessibilityLabel={label} accessibilityRole="checkbox" accessibilityState={{ checked }} hitSlop={10} onPress={onPress} style={({ pressed }) => [styles.checkbox, checked && styles.checkboxChecked, pressed && styles.pressed]}>{checked ? <Text style={styles.check}>✓</Text> : null}</Pressable>
    <Text style={styles.consentText}>{children}</Text>
  </View>;
}

export function AccountAccessScreen({ mode = "login", onOAuth, onEmail, onCreateAccount, onBack, onOpenTerms, onOpenPrivacy, onPrivacyConsentChange, onMarketingOptInChange, busyProvider = null, busy = false, error }: {
  mode?: AccountAccessMode;
  personalizedMessage?: string;
  onOAuth: (provider: SocialProvider) => void;
  onEmail: () => void;
  onCreateAccount?: () => void;
  onBack?: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  onPrivacyConsentChange?: (accepted: boolean) => void;
  onMarketingOptInChange?: (accepted: boolean) => void;
  busyProvider?: SocialProvider | null;
  busy?: boolean;
  error?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const disabled = busy || busyProvider !== null || (mode === "onboarding" && !legalAccepted);
  const title = mode === "onboarding" ? "Save your progress" : "Welcome back";

  return <View testID="social-account-access" style={styles.screen}>
    <StatusBar style="dark" />
    <View style={[styles.safeTop, { height: Math.max(insets.top, 12) }]} />
    <ScrollView testID="account-access-scroll" contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]} showsVerticalScrollIndicator={false}>
      <View testID="account-access-top-row" style={styles.topRow}>
        {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable> : <View style={styles.back} />}
        <View testID="account-access-gold-bar" style={styles.progressBar} />
      </View>
      <View style={styles.hero}><Text style={styles.title}>{title}</Text></View>
      <View testID="account-access-actions" style={styles.actions}>
        <SocialProviderButtons mode={mode} disabled={disabled} busyProvider={busyProvider} onOAuth={onOAuth} onEmail={onEmail} />
        {busy && !busyProvider ? <View style={styles.busy}><ActivityIndicator color="#17171B" /><Text style={styles.busyText}>Connecting…</Text></View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {mode === "login" && onCreateAccount ? <Pressable accessibilityRole="button" onPress={onCreateAccount} style={({ pressed }) => [styles.createAccount, pressed && styles.pressed]}><Text style={styles.createAccountText}>Create New Account</Text></Pressable> : null}
      </View>
      {mode === "onboarding" ? <View style={styles.consents}>
        <ConsentRow label="Agree to the Terms of Use and Privacy Policy" checked={legalAccepted} onPress={() => setLegalAccepted((value) => { const next = !value; onPrivacyConsentChange?.(next); return next; })}>{"I agree to Formie's "}<Text accessibilityRole="link" onPress={onOpenTerms} style={styles.link}>Terms of Use</Text> and <Text accessibilityRole="link" onPress={onOpenPrivacy} style={styles.link}>Privacy Policy</Text></ConsentRow>
        <ConsentRow label="Receive Formie tips and offers" checked={marketingOptIn} onPress={() => setMarketingOptIn((value) => { const next = !value; onMarketingOptInChange?.(next); return next; })}>Send me tips, new features, and personalized offers from Formie.</ConsentRow>
      </View> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  safeTop: { width: "100%", backgroundColor: "#FFFFFF" },
  topRow: { width: "100%", minHeight: 36, flexDirection: "row", alignItems: "center", gap: 14 },
  progressBar: { flex: 1, height: 3, backgroundColor: "#17171B", marginRight: 8 },
  content: { flexGrow: 1, width: "100%", maxWidth: 520, alignSelf: "center", justifyContent: "flex-start", paddingHorizontal: 20, paddingTop: 14 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F7FB" },
  backGlyph: { color: "#17171B", fontSize: 30, lineHeight: 32 },
  hero: { alignItems: "flex-start" },
  title: { color: "#09090B", fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -1.1, textAlign: "left", marginTop: 12 },
  actions: { width: "100%", maxWidth: 296, alignSelf: "center", gap: 20, marginTop: 116 },
  busy: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  busyText: { color: "#4B4B52", fontSize: 14 },
  error: { color: "#B42318", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  createAccount: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  createAccountText: { color: "#17171B", fontSize: 16, fontWeight: "700", textDecorationLine: "underline" },
  consents: { width: "100%", maxWidth: 296, alignSelf: "center", gap: 10, marginTop: 20 },
  consentRow: { minHeight: 28, flexDirection: "row", alignItems: "flex-start", gap: 11 },
  checkbox: { width: 18, height: 18, borderRadius: 2, borderWidth: 1.5, borderColor: "#A3A3AA", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", marginTop: 1 },
  checkboxChecked: { borderColor: "#1B1B20", backgroundColor: "#1B1B20" },
  check: { color: "#FFFFFF", fontSize: 13, lineHeight: 14, fontWeight: "900" },
  consentText: { flex: 1, color: "#29292F", fontSize: 12, lineHeight: 15 },
  link: { color: "#29292F", textDecorationLine: "underline" },
  pressed: { opacity: 0.7 },
});
