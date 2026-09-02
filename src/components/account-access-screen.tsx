import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";

import { ResponsiveScreen } from "@/components/responsive-screen";
import { SocialProviderButtons } from "@/components/social-provider-buttons";
import type { SocialProvider } from "@/features/auth/auth-service";
import { usePhoneLayoutProfile } from "@/theme/responsive";

type AccountAccessMode = "login" | "onboarding";

export function isCompactAccountAccessLayout(height: number, width: number, topInset = 0, bottomInset = 0) {
  return height - topInset - bottomInset < 660 || width < 360;
}

function ConsentRow({ label, checked, onPress, children }: { label: string; checked: boolean; onPress: () => void; children: ReactNode }) {
  return <View style={styles.consentRow}>
    <Pressable testID="account-access-checkbox" accessibilityLabel={label} accessibilityRole="checkbox" accessibilityState={{ checked }} hitSlop={10} onPress={onPress} style={({ pressed }) => [styles.checkbox, checked && styles.checkboxChecked, pressed && styles.pressed]}>{checked ? <Text style={styles.check}>✓</Text> : null}</Pressable>
    <Text style={styles.consentText}>{children}</Text>
  </View>;
}

export function AccountAccessScreen({ mode = "login", onApple, onEmailPassword, onCreateAccount, onBack, onOpenTerms, onOpenPrivacy, onPrivacyConsentChange, onMarketingOptInChange, busyProvider = null, busy = false, error, notice }: {
  mode?: AccountAccessMode;
  personalizedMessage?: string;
  onApple: () => void;
  onEmailPassword?: () => void;
  onCreateAccount?: () => void;
  onBack?: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
  onPrivacyConsentChange?: (accepted: boolean) => void;
  onMarketingOptInChange?: (accepted: boolean) => void;
  busyProvider?: SocialProvider | null;
  busy?: boolean;
  error?: string | null;
  notice?: string | null;
}) {
  const layout = usePhoneLayoutProfile();
  const compact = layout.compact || layout.short;
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const disabled = busy || busyProvider !== null || (mode === "onboarding" && !legalAccepted);
  const title = mode === "onboarding" ? "Save your progress" : "Welcome back";

  return <View testID="social-account-access" style={styles.screen}>
    <StatusBar style="light" />
    <View style={[styles.safeTop, { height: Math.max(layout.insets.top, 12) }]} />
    <ResponsiveScreen testID="account-access-scroll" keyboardAware contentContainerStyle={[styles.content, compact && styles.contentCompact]}>
      <View testID="account-access-top-row" style={styles.topRow}>
        {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}><Text style={styles.backGlyph}>‹</Text></Pressable> : <View style={styles.back} />}
        <View testID="account-access-gold-bar" style={styles.progressBar} />
      </View>
      <View style={styles.hero}><Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text></View>
      <View testID="account-access-actions" style={[styles.actions, compact && styles.actionsCompact]}>
        <SocialProviderButtons disabled={disabled} busy={busyProvider === "apple"} onApple={onApple} />
        {busy && !busyProvider ? <View style={styles.busy}><ActivityIndicator color="#E5AD32" /><Text style={styles.busyText}>Connecting…</Text></View> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {mode === "login" && onEmailPassword ? <Pressable accessibilityRole="button" accessibilityLabel="Sign in with email" disabled={disabled} onPress={onEmailPassword} style={({ pressed }) => [styles.emailSignIn, (pressed || disabled) && styles.pressed]}><Text style={styles.emailSignInText}>Sign in with email</Text></Pressable> : null}
        {mode === "login" && onCreateAccount ? <Pressable accessibilityRole="button" onPress={onCreateAccount} style={({ pressed }) => [styles.createAccount, pressed && styles.pressed]}><Text style={styles.createAccountText}>Create New Account</Text></Pressable> : null}
      </View>
      {mode === "onboarding" ? <View style={styles.consents}>
        <ConsentRow label="Agree to the Terms of Use and Privacy Policy" checked={legalAccepted} onPress={() => setLegalAccepted((value) => { const next = !value; onPrivacyConsentChange?.(next); return next; })}>{"I agree to Formie's "}<Text accessibilityRole="link" onPress={onOpenTerms} style={styles.link}>Terms of Use</Text> and <Text accessibilityRole="link" onPress={onOpenPrivacy} style={styles.link}>Privacy Policy</Text></ConsentRow>
        <ConsentRow label="Receive Formie tips and offers" checked={marketingOptIn} onPress={() => setMarketingOptIn((value) => { const next = !value; onMarketingOptInChange?.(next); return next; })}>Send me tips, new features, and personalized offers from Formie.</ConsentRow>
      </View> : null}
    </ResponsiveScreen>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#050505" },
  safeTop: { width: "100%", backgroundColor: "#050505" },
  topRow: { width: "100%", minHeight: 36, flexDirection: "row", alignItems: "center", gap: 14 },
  progressBar: { flex: 1, height: 3, backgroundColor: "#E5AD32", marginRight: 8 },
  content: { justifyContent: "flex-start", paddingTop: 14 },
  contentCompact: { paddingTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#111110", borderWidth: 1, borderColor: "#E5AD32" },
  backGlyph: { color: "#E5AD32", fontSize: 30, lineHeight: 32 },
  hero: { alignItems: "flex-start" },
  title: { color: "#F5F4F0", fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -1.1, textAlign: "left", marginTop: 12 },
  titleCompact: { fontSize: 30, lineHeight: 36 },
  actions: { width: "100%", maxWidth: 296, alignSelf: "center", gap: 20, marginTop: 116 },
  actionsCompact: { marginTop: 48 },
  busy: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  busyText: { color: "#D8D3C8", fontSize: 14 },
  error: { color: "#FF8A82", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  notice: { color: "#D8D3C8", fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  emailSignIn: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, borderCurve: "continuous", borderWidth: 1, borderColor: "#E5AD32", backgroundColor: "#111110" },
  emailSignInText: { color: "#E5AD32", fontSize: 16, fontWeight: "700" },
  createAccount: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  createAccountText: { color: "#E5AD32", fontSize: 16, fontWeight: "700", textDecorationLine: "underline" },
  consents: { width: "100%", maxWidth: 296, alignSelf: "center", gap: 10, marginTop: 20 },
  consentRow: { minHeight: 28, flexDirection: "row", alignItems: "flex-start", gap: 11 },
  checkbox: { width: 18, height: 18, borderRadius: 2, borderWidth: 1.5, borderColor: "#8E8A86", alignItems: "center", justifyContent: "center", backgroundColor: "#050505", marginTop: 1 },
  checkboxChecked: { borderColor: "#E5AD32", backgroundColor: "#E5AD32" },
  check: { color: "#080808", fontSize: 13, lineHeight: 14, fontWeight: "900" },
  consentText: { flex: 1, color: "#D8D3C8", fontSize: 12, lineHeight: 15 },
  link: { color: "#E5AD32", textDecorationLine: "underline" },
  pressed: { opacity: 0.7 },
});
