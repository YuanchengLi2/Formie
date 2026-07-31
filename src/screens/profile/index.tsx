import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { FormButton } from "@/components/form-button";
import { FormWordmark } from "@/components/form-wordmark";
import { ProductionIcon, type ProductionIconName } from "@/components/production-icon";
import { defaultCapturePreferences, type CapturePreferences } from "@/features/capture/capture-preferences";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

function SectionTitle({ children }: { children: string }) {
  return <Text selectable style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }]}>{children}</Text>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionTitle>{title}</SectionTitle>
      <View style={{ gap: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: spacing.md }}>
        {children}
      </View>
    </View>
  );
}

function ChoiceRow<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              minHeight: 42,
              justifyContent: "center",
              paddingHorizontal: spacing.md,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: selected ? colors.gold : colors.border,
              backgroundColor: selected ? colors.goldSoft : "transparent",
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Text selectable style={[typography.label, { color: selected ? colors.gold : colors.textSecondary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InfoRow({ icon, title, detail }: { icon: ProductionIconName; title: string; detail: string }) {
  return (
    <View style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <ProductionIcon name={icon} label={title} size={28} tintColor={colors.textSecondary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable style={[typography.label, { color: colors.text }]}>{title}</Text>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{detail}</Text>
      </View>
    </View>
  );
}

export function ProfileScreen({
  displayName = "Formie Athlete",
  email = "Verified account",
  capturePreferences = defaultCapturePreferences,
  onSaveProfile = async () => undefined,
  onSaveCapturePreferences = async () => undefined,
  onChangeEmail = () => undefined,
  onChangePassword = () => undefined,
  onSendFeedback = () => undefined,
  termsUrl,
  privacyUrl,
  onOpenUrl = async () => undefined,
  onLogOut = async () => undefined,
}: {
  displayName?: string;
  email?: string;
  videoRetentionDays?: 30 | null;
  capturePreferences?: CapturePreferences;
  onSaveProfile?: (profile: { displayName: string }) => Promise<void>;
  onSaveCapturePreferences?: (preferences: CapturePreferences) => Promise<void>;
  onSetRetention?: (days: 30 | null) => Promise<void>;
  onChangeEmail?: () => void;
  onChangePassword?: () => void;
  onSendFeedback?: () => void;
  termsUrl?: string;
  privacyUrl?: string;
  onOpenUrl?: (url: string) => Promise<void>;
  onLogOut?: () => Promise<void>;
}) {
  const [name, setName] = useState(displayName);
  const [capture, setCapture] = useState(capturePreferences);
  const [busy, setBusy] = useState<"apply" | "logout" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(displayName), [displayName]);
  useEffect(() => setCapture(capturePreferences), [capturePreferences]);

  const reset = () => {
    setName("Formie Athlete");
    setCapture({ countdownSeconds: 10, hapticsEnabled: true });
    setMessage("Defaults are staged. Apply Settings to save them.");
    setError(null);
  };

  const apply = async () => {
    if (busy || name.trim().length < 2) return;
    setBusy("apply");
    setMessage(null);
    setError(null);
    try {
      await onSaveProfile({ displayName: name.trim() });
      await onSaveCapturePreferences(capture);
      setMessage("Settings applied.");
    } catch {
      setError("Settings could not be applied. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const logOut = async () => {
    if (busy) return;
    setBusy("logout");
    setError(null);
    try {
      await onLogOut();
    } catch {
      setError("Could not log out. Try again.");
      setBusy(null);
    }
  };

  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <FormWordmark />
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Settings</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Your profile, camera, privacy, and account.</Text>
      </View>

      <Section title="Profile">
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, borderWidth: 1, borderColor: colors.gold }}>
            <Text selectable style={{ color: colors.gold, fontSize: 20 }}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable numberOfLines={1} style={[typography.heading, { color: colors.text }]}>{name}</Text>
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{email}</Text>
          </View>
        </View>
        <TextInput accessibilityLabel="Username" autoCapitalize="words" maxLength={60} value={name} onChangeText={setName} style={[typography.body, { minHeight: 50, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: "transparent" }]} />
      </Section>

      <Section title="Capture">
        <Text selectable style={[typography.heading, { color: colors.text }]}>Countdown</Text>
        <ChoiceRow options={[5, 10, 15].map((seconds) => ({ value: seconds as 5 | 10 | 15, label: `${seconds} sec` }))} value={capture.countdownSeconds} onChange={(countdownSeconds) => setCapture({ ...capture, countdownSeconds })} />
        <View style={{ minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text selectable style={[typography.label, { color: colors.text }]}>Start haptics</Text>
            <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Vibrate when recording begins.</Text>
          </View>
          <Switch accessibilityLabel="Start haptics" value={capture.hapticsEnabled} onValueChange={(hapticsEnabled) => setCapture({ ...capture, hapticsEnabled })} trackColor={{ false: colors.surfaceRaised, true: colors.goldSoft }} thumbColor={capture.hapticsEnabled ? colors.gold : colors.textMuted} />
        </View>
      </Section>

      <Section title="Privacy and retention">
        <InfoRow icon="privacyLock" title="Saved on this device" detail="Your recording stays in Formie's private device storage" />
        <InfoRow icon="videoStorage" title="No cloud video library" detail="Analysis uploads are removed after processing" />
      </Section>

      <Section title="Account">
        <Pressable accessibilityRole="button" onPress={onChangeEmail} style={{ minHeight: 50, justifyContent: "center", borderBottomWidth: 1, borderColor: colors.border }}><Text selectable style={[typography.label, { color: colors.text }]}>Change Email</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onChangePassword} style={{ minHeight: 50, justifyContent: "center" }}><Text selectable style={[typography.label, { color: colors.text }]}>Change Password</Text></Pressable>
      </Section>

      <Section title="Support">
        <Pressable accessibilityRole="button" onPress={onSendFeedback} style={{ minHeight: 50, justifyContent: "center" }}>
          <Text selectable style={[typography.label, { color: colors.gold }]}>Send Feedback</Text>
        </Pressable>
      </Section>

      {termsUrl || privacyUrl ? (
        <Section title="Legal">
          {termsUrl ? <Pressable accessibilityRole="link" onPress={() => void onOpenUrl(termsUrl)} style={{ minHeight: 50, justifyContent: "center", borderBottomWidth: privacyUrl ? 1 : 0, borderColor: colors.border }}><Text selectable style={[typography.label, { color: colors.gold }]}>Terms of Use</Text></Pressable> : null}
          {privacyUrl ? <Pressable accessibilityRole="link" onPress={() => void onOpenUrl(privacyUrl)} style={{ minHeight: 50, justifyContent: "center" }}><Text selectable style={[typography.label, { color: colors.gold }]}>Privacy Policy</Text></Pressable> : null}
        </Section>
      ) : null}

      {message ? <Text accessibilityRole="alert" selectable style={[typography.caption, { color: colors.gold }]}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" selectable style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={reset} style={({ pressed }) => ({ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, opacity: pressed || busy ? 0.6 : 1 })}>
          <Text selectable style={[typography.label, { color: colors.textSecondary }]}>Reset Settings</Text>
        </Pressable>
        <FormButton style={{ flex: 1 }} label={busy === "apply" ? "Applying…" : "Apply Settings"} disabled={Boolean(busy) || name.trim().length < 2} onPress={() => void apply()} />
      </View>
      <Pressable testID="logout-button" accessibilityLabel="Log Out" accessibilityRole="button" disabled={Boolean(busy)} onPress={() => void logOut()} style={({ pressed }) => ({ minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: radii.md, backgroundColor: colors.danger, opacity: pressed || busy ? 0.7 : 1 })}>
        <Text selectable style={[typography.label, { color: colors.text }]}>{busy === "logout" ? "Logging Out…" : "Log Out"}</Text>
      </Pressable>
      <Text selectable style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>Formie 1.0</Text>
    </ScrollView>
  );
}
