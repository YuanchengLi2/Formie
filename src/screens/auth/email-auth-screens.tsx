import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type EmailAuthIntent = "login" | "onboarding";

function EmailShell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={styles.screen}><StatusBar style="light" /><View style={[styles.goldBar, { height: Math.max(insets.top, 12) + 6 }]} /><ScrollView testID="email-auth-scroll" contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 28) }]}>{children}</ScrollView></View>;
}

function BackButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Text style={styles.backText}>‹</Text></Pressable>;
}

function SubmitButton({ label, disabled, busy, onPress }: { label: string; disabled: boolean; busy: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.submit, disabled && styles.disabled, pressed && styles.pressed]}>{busy ? <ActivityIndicator color="#080808" /> : <Text style={styles.submitText}>{label}</Text>}</Pressable>;
}

export function EmailEntryScreen({ intent, busy, error, onBack, onSubmit }: { intent: EmailAuthIntent; busy: boolean; error: string | null; onBack: () => void; onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const submit = () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setValidation("Enter a valid email address."); return; }
    setValidation(null);
    onSubmit(normalized);
  };
  return <EmailShell><BackButton onPress={onBack} /><View style={styles.copy}><Text style={styles.title}>{intent === "onboarding" ? "Save your account with email" : "Sign in with email"}</Text><Text style={styles.message}>{intent === "onboarding" ? "We’ll send one secure code to save the coaching profile you just built." : "We’ll send one secure code. The same flow works for an existing or new Formie account."}</Text></View><View style={styles.form}><Text style={styles.label}>EMAIL ADDRESS</Text><TextInput accessibilityLabel="Email address" autoCapitalize="none" autoComplete="email" inputMode="email" keyboardType="email-address" returnKeyType="send" value={email} onChangeText={setEmail} onSubmitEditing={submit} placeholder="you@example.com" placeholderTextColor="#77736E" style={styles.input} />{validation || error ? <Text accessibilityRole="alert" style={styles.error}>{validation ?? error}</Text> : null}<SubmitButton label="Send my code" disabled={busy || email.trim().length === 0} busy={busy} onPress={submit} /></View></EmailShell>;
}

export function EmailCodeScreen({ email, intent, busy, error, onBack, onVerify, onResend }: { email: string; intent: EmailAuthIntent; busy: boolean; error: string | null; onBack: () => void; onVerify: (code: string) => void; onResend: () => void }) {
  const [code, setCode] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const verify = () => { if (code.length !== 6) { setValidation("Enter the full six-digit code."); return; } setValidation(null); onVerify(code); };
  return <EmailShell><BackButton onPress={onBack} /><View style={styles.copy}><Text style={styles.title}>{intent === "onboarding" ? "Save your account with the code we sent" : "Enter your sign-in code"}</Text><Text style={styles.message}>Sent to {email}. The code expires, so use the newest email if you requested it more than once.</Text></View><View style={styles.form}><Text style={styles.label}>SIX-DIGIT CODE</Text><TextInput accessibilityLabel="Six digit code" autoComplete="one-time-code" inputMode="numeric" keyboardType="number-pad" maxLength={6} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} onSubmitEditing={verify} placeholder="000000" placeholderTextColor="#77736E" style={[styles.input, styles.code]} />{validation || error ? <Text accessibilityRole="alert" style={styles.error}>{validation ?? error}</Text> : null}<SubmitButton label={intent === "onboarding" ? "Verify and save my account" : "Verify and sign in"} disabled={busy || code.length !== 6} busy={busy} onPress={verify} /><Pressable accessibilityRole="button" disabled={busy} onPress={onResend} style={({ pressed }) => [styles.resend, pressed && styles.pressed]}><Text style={styles.resendText}>Send a new code</Text></Pressable></View></EmailShell>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#030303" },
  goldBar: { width: "100%", backgroundColor: "#D9A83F" },
  content: { flexGrow: 1, width: "100%", maxWidth: 620, alignSelf: "center", justifyContent: "center", gap: 34, paddingHorizontal: 24, paddingTop: 20 },
  back: { alignSelf: "flex-start", width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, borderWidth: 1, borderColor: "#49443C" },
  backText: { color: "#F8F7F5", fontSize: 42, lineHeight: 43, fontWeight: "300" },
  copy: { gap: 14 },
  title: { color: "#F8F7F5", fontSize: 38, lineHeight: 43, fontWeight: "800", letterSpacing: -1 },
  message: { color: "#F8F7F5", fontSize: 18, lineHeight: 27, fontWeight: "600" },
  form: { gap: 14 },
  label: { color: "#F4B531", fontSize: 11, letterSpacing: 2, fontWeight: "800" },
  input: { minHeight: 64, borderRadius: 16, borderCurve: "continuous", borderWidth: 1, borderColor: "#625B50", paddingHorizontal: 18, backgroundColor: "#0B0B0B", color: "#F8F7F5", fontSize: 19 },
  code: { fontSize: 30, letterSpacing: 9, fontVariant: ["tabular-nums"], textAlign: "center" },
  submit: { minHeight: 66, alignItems: "center", justifyContent: "center", borderRadius: 18, borderCurve: "continuous", backgroundColor: "#F4B531", paddingHorizontal: 18 },
  submitText: { color: "#080808", fontSize: 18, fontWeight: "900" },
  resend: { minHeight: 52, alignItems: "center", justifyContent: "center" },
  resendText: { color: "#F4B531", fontSize: 16, fontWeight: "700" },
  error: { color: "#FF8A8A", fontSize: 14, lineHeight: 20, fontWeight: "600" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
