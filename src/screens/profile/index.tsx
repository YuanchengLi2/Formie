import { Image } from "expo-image";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from "react-native";

import { SubscriptionBoundary } from "@/components/subscription-boundary";
import type { BillingBoundaryInput } from "@/features/access/billing-boundary";
import { defaultCapturePreferences, type CapturePreferences } from "@/features/capture/capture-preferences";
import type { SubscriptionTestAction } from "@/features/billing/subscription-test-controls";
import { colors } from "@/theme/colors";

const background = require("../../../assets/production/settings/settings-background.png");
const mark = require("../../../assets/images/form-logo-mark.png");

type ProfileSubscription = { plan: string; stateLabel: string; access?: BillingBoundaryInput };

export function ProfileScreen({ displayName = "Formie Athlete", email = null, subscription, capturePreferences = defaultCapturePreferences, onSaveProfile = async () => undefined, onSaveCapturePreferences = async () => undefined, onSendFeedback = () => undefined, onManageSubscription = () => undefined, onSubscriptionBoundary, termsUrl, privacyUrl, retentionUrl, onOpenUrl = async () => undefined, onLogOut = async () => undefined, showTestControls = false, showAnalysisBalanceControl = false, testRemaining = null, onTestControl = async () => undefined, onSetTestRemaining = async () => undefined }: {
  displayName?: string;
  email?: string | null;
  subscription?: ProfileSubscription;
  capturePreferences?: CapturePreferences;
  onSaveProfile?: (profile: { displayName: string }) => Promise<void>;
  onSaveCapturePreferences?: (preferences: CapturePreferences) => Promise<void>;
  onSendFeedback?: () => void;
  onManageSubscription?: () => void;
  onSubscriptionBoundary?: () => void;
  termsUrl?: string;
  privacyUrl?: string;
  retentionUrl?: string;
  onOpenUrl?: (url: string) => Promise<void>;
  onLogOut?: () => Promise<void>;
  showTestControls?: boolean;
  showAnalysisBalanceControl?: boolean;
  testRemaining?: number | null;
  onTestControl?: (action: SubscriptionTestAction) => Promise<void>;
  onSetTestRemaining?: (remaining: number) => Promise<void>;
}) {
  const { width } = useWindowDimensions();
  const scale = Math.min(1.08, Math.max(0.84, width / 426.5));
  const [name, setName] = useState(displayName);
  const [draftName, setDraftName] = useState(displayName);
  const [editingName, setEditingName] = useState(false);
  const [capture, setCapture] = useState(capturePreferences);
  const [busy, setBusy] = useState<"profile" | "logout" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testDraft, setTestDraft] = useState(Math.max(0, Math.min(10, testRemaining ?? 10)));
  useEffect(() => { setName(displayName); setDraftName(displayName); }, [displayName]);
  useEffect(() => setCapture(capturePreferences), [capturePreferences]);
  useEffect(() => setTestDraft(Math.max(0, Math.min(10, testRemaining ?? 10))), [testRemaining]);

  const commitCapture = async (next: CapturePreferences) => {
    setCapture(next);
    setError(null);
    try { await onSaveCapturePreferences(next); }
    catch { setCapture(capture); setError("That preference could not be saved. Try again."); }
  };
  const saveName = async () => {
    const trimmed = draftName.trim();
    if (busy || trimmed.length < 2) return;
    setBusy("profile"); setError(null);
    try { await onSaveProfile({ displayName: trimmed }); setName(trimmed); setEditingName(false); }
    catch { setError("Your display name could not be saved. Try again."); }
    finally { setBusy(null); }
  };
  const reset = () => Alert.alert("Reset Settings?", "This restores the 10-second countdown, both haptic switches, and the default display name.", [
    { text: "Cancel", style: "cancel" },
    { text: "Reset", style: "destructive", onPress: () => {
      const defaults = defaultCapturePreferences;
      setBusy("reset"); setError(null);
      void Promise.all([onSaveCapturePreferences(defaults), onSaveProfile({ displayName: "Formie Athlete" })])
        .then(() => { setCapture(defaults); setName("Formie Athlete"); setDraftName("Formie Athlete"); })
        .catch(() => setError("Settings could not be reset. Try again."))
        .finally(() => setBusy(null));
    } },
  ]);
  const logOut = async () => { if (busy) return; setBusy("logout"); setError(null); try { await onLogOut(); } catch { setError("Could not log out. Try again."); setBusy(null); } };

  return <ImageBackground source={background} resizeMode="cover" style={styles.root}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 19 * scale, paddingHorizontal: 18 * scale, paddingTop: 13 * scale, paddingBottom: 32 * scale }}>
      <View style={{ gap: 8 * scale }}>
        <Image source={mark} contentFit="contain" accessibilityLabel="Formie" style={{ width: 39 * scale, height: 39 * scale }} />
        <Text accessibilityRole="header" style={[styles.title, { fontSize: 39 * scale, lineHeight: 43 * scale }]}>Settings</Text>
        <Text style={[styles.subtitle, { fontSize: 14 * scale }]}>Manage your profile, subscription, and recording preferences.</Text>
      </View>

      <Card>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit account" onPress={() => setEditingName(true)} style={styles.accountRow}>
          <View style={[styles.avatar, { width: 49 * scale, height: 49 * scale, borderRadius: 25 * scale }]}><Text style={[styles.avatarText, { fontSize: 19 * scale }]}>{name.slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1, gap: 3 }}><Text numberOfLines={1} style={[styles.accountName, { fontSize: 17 * scale }]}>{name}</Text>{email ? <Text numberOfLines={1} style={[styles.accountEmail, { fontSize: 11.5 * scale }]}>{email}</Text> : null}</View>
          <Text style={[styles.chevron, { fontSize: 27 * scale }]}>›</Text>
        </Pressable>
      </Card>

      <View style={{ gap: 8 * scale }}>
        <SectionLabel>Subscription</SectionLabel>
        <Card>
          <Pressable accessibilityRole="button" accessibilityLabel="Manage subscription" onPress={onManageSubscription} style={styles.subscriptionRow}>
            <View style={[styles.crown, { width: 45 * scale, height: 45 * scale, borderRadius: 14 * scale }]}><Text style={{ color: colors.gold, fontSize: 21 * scale }}>♛</Text></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.accountName, { fontSize: 16 * scale }]}>{subscription?.plan ?? "Formie Monthly"}</Text>
              <Text style={[styles.stateLabel, { fontSize: 11.5 * scale }]}>{subscription?.stateLabel ?? "Choose your plan"}</Text>
              {subscription?.access?.paidThrough ? <SubscriptionBoundary access={subscription.access} onBoundary={onSubscriptionBoundary} countdownStyle={{ fontSize: 11.5 * scale }} timestampStyle={{ fontSize: 10 * scale }} /> : null}
            </View>
            <Text testID="subscription-chevron" style={[styles.chevron, { alignSelf: "center", fontSize: 27 * scale }]}>›</Text>
          </Pressable>
        </Card>
      </View>

      {showAnalysisBalanceControl || showTestControls ? <SettingsGroup title="Analysis balance">
        <Text style={styles.testCopy}>Sandbox only. This changes the remaining analyses without changing Apple billing dates.</Text>
        <View style={styles.testRow}><Pressable accessibilityLabel="Decrease analyses remaining" onPress={() => setTestDraft(Math.max(0, testDraft - 1))} style={styles.testButton}><Text style={styles.testText}>−</Text></Pressable><Text style={styles.testCopy}>Analyses remaining: {testDraft}</Text><Pressable accessibilityLabel="Increase analyses remaining" onPress={() => setTestDraft(Math.min(10, testDraft + 1))} style={styles.testButton}><Text style={styles.testText}>+</Text></Pressable><Pressable accessibilityLabel="Apply remaining analyses" onPress={() => void onSetTestRemaining(testDraft)} style={styles.testApply}><Text style={styles.testApplyText}>Apply</Text></Pressable></View>
      </SettingsGroup> : null}

      <SettingsGroup title="Preferences">
        <SettingsRow label="Countdown" detail="Before recording starts"><View style={styles.countdownChoices}>{([5, 10, 15] as const).map((seconds) => <Pressable key={seconds} accessibilityRole="button" accessibilityState={{ selected: capture.countdownSeconds === seconds }} onPress={() => void commitCapture({ ...capture, countdownSeconds: seconds })} style={[styles.countdownPill, capture.countdownSeconds === seconds && styles.countdownPillSelected]}><Text style={[styles.pillText, capture.countdownSeconds === seconds && { color: "#080808" }]}>{seconds}s</Text></Pressable>)}</View></SettingsRow>
        <Rule />
        <SettingsRow label="Vibrate on record" detail="Success vibration when recording begins"><Switch accessibilityLabel="Vibrate on record" value={capture.recordingVibrationEnabled} onValueChange={(recordingVibrationEnabled) => void commitCapture({ ...capture, recordingVibrationEnabled })} trackColor={{ false: "#343434", true: colors.goldSoft }} thumbColor={capture.recordingVibrationEnabled ? colors.gold : "#909090"} /></SettingsRow>
        <Rule />
        <SettingsRow label="Start haptics" detail="Feedback on buttons and onboarding"><Switch accessibilityLabel="Start haptics" value={capture.interactionHapticsEnabled} onValueChange={(interactionHapticsEnabled) => void commitCapture({ ...capture, interactionHapticsEnabled })} trackColor={{ false: "#343434", true: colors.goldSoft }} thumbColor={capture.interactionHapticsEnabled ? colors.gold : "#909090"} /></SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Support & Legal">
        <LinkRow label="Help & Support" onPress={onSendFeedback} />
        {privacyUrl ? <><Rule /><LinkRow label="Privacy Policy" onPress={() => void onOpenUrl(privacyUrl)} /></> : null}
        {termsUrl ? <><Rule /><LinkRow label="Terms of Use" onPress={() => void onOpenUrl(termsUrl)} /></> : null}
        {retentionUrl ? <><Rule /><LinkRow label="Retention Policy" onPress={() => void onOpenUrl(retentionUrl)} /></> : null}
      </SettingsGroup>

      {showTestControls ? <SettingsGroup title="Test Store lifecycle">
        <Text style={styles.testCopy}>Development only. Provider timing still comes from the returned entitlement period.</Text>
        <View style={styles.testActions}>{([ ["renew_now", "Renew Now"], ["expire_now", "Expire"], ["start_new_period", "Start 20-minute Period"], ["advance_annual_quota_month", "Advance Annual Month"], ["clear", "Clear Simulation"] ] as [SubscriptionTestAction, string][]).map(([action, label]) => <Pressable key={action} onPress={() => void onTestControl(action)} style={styles.testButton}><Text style={styles.testText}>{label}</Text></Pressable>)}</View>
      </SettingsGroup> : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={reset} style={({ pressed }) => [styles.resetButton, { opacity: pressed || busy ? 0.6 : 1 }]}><Text style={styles.resetText}>{busy === "reset" ? "Resetting…" : "Reset to Defaults"}</Text></Pressable>
      <Pressable testID="logout-button" accessibilityLabel="Log Out" accessibilityRole="button" disabled={Boolean(busy)} onPress={() => void logOut()} style={({ pressed }) => [styles.logoutButton, { opacity: pressed || busy ? 0.6 : 1 }]}><Text style={styles.logoutText}>{busy === "logout" ? "Logging Out…" : "Log Out"}</Text></Pressable>
      <Text style={styles.version}>Formie 1.0</Text>
    </ScrollView>

    <Modal visible={editingName} animationType="fade" transparent onRequestClose={() => setEditingName(false)}>
      <View style={styles.modalScrim}><View style={styles.modalCard}><Text style={styles.modalTitle}>Display name</Text><Text style={styles.modalCopy}>This is how your account appears inside Formie.</Text><TextInput accessibilityLabel="Display name" autoFocus autoCapitalize="words" maxLength={60} value={draftName} onChangeText={setDraftName} style={styles.input} /><View style={styles.modalActions}><Pressable accessibilityRole="button" onPress={() => { setDraftName(name); setEditingName(false); }} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={busy === "profile" || draftName.trim().length < 2} onPress={() => void saveName()} style={styles.modalSave}><Text style={styles.modalSaveText}>{busy === "profile" ? "Saving…" : "Save"}</Text></Pressable></View></View></View>
    </Modal>
  </ImageBackground>;
}

function Card({ children }: { children: ReactNode }) { return <View style={styles.card}>{children}</View>; }
function SectionLabel({ children }: { children: ReactNode }) { return <Text style={styles.sectionLabel}>{children}</Text>; }
function SettingsGroup({ title, children }: { title: string; children: ReactNode }) { return <View style={{ gap: 8 }}><SectionLabel>{title}</SectionLabel><Card>{children}</Card></View>; }
function Rule() { return <View style={styles.rule} />; }
function SettingsRow({ label, detail, children }: { label: string; detail: string; children: ReactNode }) { return <View style={styles.settingsRow}><View style={{ flex: 1, gap: 3 }}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.rowDetail}>{detail}</Text></View>{children}</View>; }
function LinkRow({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.linkRow}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.linkChevron}>›</Text></Pressable>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050505" }, title: { color: colors.text, fontWeight: "700", letterSpacing: -1.3 }, subtitle: { color: colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: "rgba(18,18,18,0.93)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", borderRadius: 19, padding: 15, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  accountRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 }, avatar: { alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold }, avatarText: { color: colors.gold, fontWeight: "800" }, accountName: { color: colors.text, fontWeight: "700" }, accountEmail: { color: colors.textMuted }, chevron: { color: colors.gold, lineHeight: 30 },
  sectionLabel: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14, fontWeight: "700", letterSpacing: 1.1, textTransform: "uppercase", paddingHorizontal: 3 }, subscriptionRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, crown: { alignItems: "center", justifyContent: "center", backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: "rgba(200,169,107,0.28)" }, stateLabel: { color: colors.textSecondary, lineHeight: 17 },
  settingsRow: { minHeight: 57, flexDirection: "row", alignItems: "center", gap: 12 }, rowTitle: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "600" }, rowDetail: { color: colors.textMuted, fontSize: 10.5, lineHeight: 15 }, rule: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.09)", marginVertical: 8 }, countdownChoices: { flexDirection: "row", gap: 5 }, countdownPill: { minWidth: 34, height: 29, alignItems: "center", justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: colors.border }, countdownPillSelected: { backgroundColor: colors.gold, borderColor: colors.gold }, pillText: { color: colors.textSecondary, fontSize: 10.5, fontWeight: "700" },
  linkRow: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, linkChevron: { color: colors.gold, fontSize: 23 }, resetButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(18,18,18,0.88)" }, resetText: { color: colors.text, fontSize: 13, fontWeight: "600" }, logoutButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: colors.danger, backgroundColor: "rgba(20,5,5,0.46)" }, logoutText: { color: colors.danger, fontSize: 13, fontWeight: "700" }, error: { color: colors.danger, fontSize: 11.5, textAlign: "center" }, version: { color: colors.textMuted, fontSize: 10.5, textAlign: "center" },
  modalScrim: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.74)" }, modalCard: { borderRadius: 22, padding: 20, gap: 13, backgroundColor: "#171717", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }, modalTitle: { color: colors.text, fontSize: 22, fontWeight: "700" }, modalCopy: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 }, input: { minHeight: 51, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.gold, color: colors.text, backgroundColor: "#0D0D0D", fontSize: 15 }, modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9 }, modalCancel: { minHeight: 43, paddingHorizontal: 18, justifyContent: "center" }, modalCancelText: { color: colors.textSecondary, fontWeight: "600" }, modalSave: { minHeight: 43, paddingHorizontal: 20, justifyContent: "center", borderRadius: 12, backgroundColor: colors.gold }, modalSaveText: { color: "#080808", fontWeight: "800" },
  testCopy: { color: colors.textMuted, fontSize: 10.5, lineHeight: 15 }, testRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: 10 }, testActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 }, testButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 10, borderRadius: 99, borderWidth: 1, borderColor: colors.gold }, testText: { color: colors.gold, fontSize: 10.5, fontWeight: "600" }, testApply: { minHeight: 34, justifyContent: "center", paddingHorizontal: 11, borderRadius: 99, backgroundColor: colors.gold }, testApplyText: { color: "#080808", fontSize: 10.5, fontWeight: "700" },
});
