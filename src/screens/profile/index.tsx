import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import { defaultCapturePreferences, type CapturePreferences } from "@/features/capture/capture-preferences";
import type { SubscriptionTestAction } from "@/features/billing/subscription-test-controls";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={{ gap: spacing.sm }}><Text selectable style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", paddingHorizontal: spacing.xs }]}>{title}</Text><View style={{ gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, borderCurve: "continuous", backgroundColor: colors.surface, padding: spacing.lg }}>{children}</View></View>;
}

function ChoiceRow<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{options.map((option) => { const selected = value === option.value; return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={option.value} onPress={() => onChange(option.value)} style={({ pressed }) => ({ minHeight: 42, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: selected ? colors.gold : colors.border, backgroundColor: selected ? colors.goldSoft : "transparent", opacity: pressed ? 0.72 : 1 })}><Text selectable style={[typography.label, { color: selected ? colors.gold : colors.textSecondary }]}>{option.label}</Text></Pressable>; })}</View>;
}

export function ProfileScreen({ displayName = "Formie Athlete", email = null, subscription, capturePreferences = defaultCapturePreferences, onSaveProfile = async () => undefined, onSaveCapturePreferences = async () => undefined, onSendFeedback = () => undefined, onManageSubscription = () => undefined, termsUrl, privacyUrl, retentionUrl, onOpenUrl = async () => undefined, onLogOut = async () => undefined, showTestControls = false, testRemaining: currentTestRemaining = null, onTestControl = async () => undefined, onSetTestRemaining = async () => undefined }: {
  displayName?: string;
  email?: string | null;
  subscription?: { plan: string; stateLabel: string };
  capturePreferences?: CapturePreferences;
  onSaveProfile?: (profile: { displayName: string }) => Promise<void>;
  onSaveCapturePreferences?: (preferences: CapturePreferences) => Promise<void>;
  onSendFeedback?: () => void;
  onManageSubscription?: () => void;
  termsUrl?: string;
  privacyUrl?: string;
  retentionUrl?: string;
  onOpenUrl?: (url: string) => Promise<void>;
  onLogOut?: () => Promise<void>;
  showTestControls?: boolean;
  testRemaining?: number | null;
  onTestControl?: (action: SubscriptionTestAction) => Promise<void>;
  onSetTestRemaining?: (remaining: number) => Promise<void>;
}) {
  const [name, setName] = useState(displayName);
  const [capture, setCapture] = useState(capturePreferences);
  const [busy, setBusy] = useState<"apply" | "logout" | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testRemainingDraft, setTestRemaining] = useState(Math.max(0, Math.min(10, currentTestRemaining ?? 10)));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setName(displayName), [displayName]);
  useEffect(() => setCapture(capturePreferences), [capturePreferences]);
  useEffect(() => setTestRemaining(Math.max(0, Math.min(10, currentTestRemaining ?? 10))), [currentTestRemaining]);
  const dirty = name.trim() !== displayName || capture.countdownSeconds !== capturePreferences.countdownSeconds || capture.hapticsEnabled !== capturePreferences.hapticsEnabled;

  const apply = async () => {
    if (busy || name.trim().length < 2) return;
    setBusy("apply"); setMessage(null); setError(null);
    try { await onSaveProfile({ displayName: name.trim() }); await onSaveCapturePreferences(capture); setMessage("Settings applied."); }
    catch { setError("Settings could not be applied. Try again."); }
    finally { setBusy(null); }
  };
  const reset = () => { setName("Formie Athlete"); setCapture({ countdownSeconds: 10, hapticsEnabled: true }); setMessage("Defaults are staged. Apply Settings to save them."); setError(null); };
  const logOut = async () => { if (busy) return; setBusy("logout"); setError(null); try { await onLogOut(); } catch { setError("Could not log out. Try again."); setBusy(null); } };

  return <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl }}>
    <FormWordmark />
    <View style={{ gap: spacing.xs }}><Text selectable style={[typography.title, { color: colors.text }]}>Settings</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Your athlete profile, camera, and account preferences.</Text></View>
    <Section title="Identity"><View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}><View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold }}><Text selectable style={{ color: colors.gold, fontSize: 20 }}>{name.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1, gap: 2 }}><Text selectable numberOfLines={1} style={[typography.heading, { color: colors.text }]}>{name}</Text>{email ? <Text selectable numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>{email}</Text> : null}</View></View><TextInput accessibilityLabel="Display name" autoCapitalize="words" maxLength={60} value={name} onChangeText={setName} style={[typography.body, { minHeight: 50, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, color: colors.text }]} /></Section>
    <Section title="Subscription"><Pressable accessibilityRole="button" accessibilityLabel="Manage subscription" onPress={onManageSubscription} style={{ minHeight: 52, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}><View style={{ flex: 1, gap: 3 }}><Text selectable style={[typography.heading, { color: colors.text }]}>{subscription?.plan ?? "Manage subscription"}</Text>{subscription ? <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{subscription.stateLabel}</Text> : null}</View><Text testID="subscription-chevron" style={{ alignSelf: "flex-start", color: colors.gold, fontSize: 22, lineHeight: 24 }}>›</Text></Pressable></Section>
    <Section title="Capture"><Text selectable style={[typography.heading, { color: colors.text }]}>Countdown</Text><ChoiceRow options={[5, 10, 15].map((seconds) => ({ value: seconds as 5 | 10 | 15, label: `${seconds} sec` }))} value={capture.countdownSeconds} onChange={(countdownSeconds) => setCapture({ ...capture, countdownSeconds })} /><View style={{ minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}><View style={{ flex: 1, gap: 2 }}><Text selectable style={[typography.label, { color: colors.text }]}>Start haptics</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>Vibrate when recording begins.</Text></View><Switch accessibilityLabel="Start haptics" value={capture.hapticsEnabled} onValueChange={(hapticsEnabled) => setCapture({ ...capture, hapticsEnabled })} trackColor={{ false: colors.surfaceRaised, true: colors.goldSoft }} thumbColor={capture.hapticsEnabled ? colors.gold : colors.textMuted} /></View></Section>
    {privacyUrl || retentionUrl ? <Section title="Privacy and retention">{privacyUrl ? <Pressable accessibilityRole="link" onPress={() => void onOpenUrl(privacyUrl)} style={{ minHeight: 50, justifyContent: "center" }}><Text selectable style={[typography.label, { color: colors.gold }]}>Privacy Policy</Text></Pressable> : null}{retentionUrl ? <Pressable accessibilityRole="link" onPress={() => void onOpenUrl(retentionUrl)} style={{ minHeight: 50, justifyContent: "center" }}><Text selectable style={[typography.label, { color: colors.gold }]}>Retention Policy</Text></Pressable> : null}</Section> : null}
    <Section title="Support"><Pressable accessibilityRole="button" onPress={onSendFeedback} style={{ minHeight: 50, justifyContent: "center" }}><Text selectable style={[typography.label, { color: colors.gold }]}>Get Help</Text></Pressable></Section>
    {showTestControls ? <Section title="Test Store lifecycle"><Text selectable style={[typography.caption, { color: colors.textMuted }]}>Development only. These simulate the server lifecycle without changing a real receipt.</Text><View style={{ gap: spacing.sm }}><Text selectable style={[typography.label, { color: colors.text }]}>Analyses remaining: {testRemainingDraft}</Text><View style={{ flexDirection: "row", gap: spacing.sm }}><Pressable accessibilityRole="button" accessibilityLabel="Decrease analyses remaining" disabled={testBusy || testRemainingDraft <= 0} onPress={() => setTestRemaining((value) => Math.max(0, value - 1))} style={({ pressed }) => ({ minHeight: 40, minWidth: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.gold, opacity: pressed || testBusy || testRemainingDraft <= 0 ? 0.5 : 1 })}><Text selectable style={[typography.heading, { color: colors.gold }]}>-</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Increase analyses remaining" disabled={testBusy || testRemainingDraft >= 10} onPress={() => setTestRemaining((value) => Math.min(10, value + 1))} style={({ pressed }) => ({ minHeight: 40, minWidth: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.gold, opacity: pressed || testBusy || testRemainingDraft >= 10 ? 0.5 : 1 })}><Text selectable style={[typography.heading, { color: colors.gold }]}>+</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Apply remaining analyses" disabled={testBusy} onPress={async () => { if (!onSetTestRemaining) return; setTestBusy(true); setMessage(null); setError(null); try { await onSetTestRemaining(testRemainingDraft); setMessage("Remaining analyses updated."); } catch { setError("The Test Store balance could not be updated."); } finally { setTestBusy(false); } }} style={({ pressed }) => ({ minHeight: 40, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.gold, opacity: pressed || testBusy ? 0.6 : 1 })}><Text selectable style={[typography.label, { color: "#080808" }]}>{testBusy ? "Applying..." : "Apply"}</Text></Pressable></View></View><View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{([
      ["renew_now", "Renew Now"], ["expire_now", "Expire"], ["start_new_period", "Start 20-minute Period"], ["advance_annual_quota_month", "Advance Annual Month"], ["clear", "Clear Simulation"],
    ] as [SubscriptionTestAction, string][]).map(([action, label]) => <Pressable key={action} accessibilityRole="button" disabled={testBusy} onPress={async () => { setTestBusy(true); setMessage(null); setError(null); try { await onTestControl(action); setMessage("Test Store state updated."); } catch { setError("The Test Store action could not be applied."); } finally { setTestBusy(false); } }} style={({ pressed }) => ({ minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.gold, opacity: pressed || testBusy ? 0.5 : 1 })}><Text selectable style={[typography.caption, { color: colors.gold }]}>{label}</Text></Pressable>)}</View></Section> : null}
    {termsUrl ? <Section title="Legal"><Pressable accessibilityRole="link" onPress={() => void onOpenUrl(termsUrl)} style={{ minHeight: 50, justifyContent: "center" }}><Text selectable style={[typography.label, { color: colors.gold }]}>Terms of Use</Text></Pressable></Section> : null}
    {message ? <Text accessibilityRole="alert" style={[typography.caption, { color: colors.gold }]}>{message}</Text> : null}{error ? <Text accessibilityRole="alert" style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
    <View style={{ flexDirection: "row", gap: spacing.md }}><Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={reset} style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, opacity: pressed || busy ? 0.6 : 1 })}><Text selectable style={[typography.label, { color: colors.textSecondary }]}>Reset to Defaults</Text></Pressable>{dirty ? <FormButton style={{ flex: 1, minHeight: 48 }} label={busy === "apply" ? "Saving…" : "Save Changes"} disabled={Boolean(busy) || name.trim().length < 2} onPress={() => void apply()} /> : null}</View>
    <Pressable testID="logout-button" accessibilityLabel="Log Out" accessibilityRole="button" disabled={Boolean(busy)} onPress={() => void logOut()} style={({ pressed }) => ({ minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: "transparent", opacity: pressed || busy ? 0.7 : 1 })}><Text selectable style={[typography.label, { color: colors.danger }]}>{busy === "logout" ? "Logging Out…" : "Log Out"}</Text></Pressable>
    <Text selectable style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>Formie 1.0</Text>
  </ScrollView>;
}
