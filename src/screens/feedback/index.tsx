import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { FormButton } from "@/components/form-button";
import type { FeedbackCategory } from "@/features/feedback/api";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const categories: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature_request", label: "Feature request" },
  { value: "general", label: "General" },
  { value: "priority_support", label: "Priority support" },
];

export function FeedbackScreen({
  onSubmit,
  onBack = () => undefined,
}: {
  onSubmit: (input: { category: FeedbackCategory; message: string }) => Promise<{ submitted: true; requestId: string }>;
  onBack?: () => void;
}) {
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"sent" | "error" | null>(null);
  const trimmed = message.trim();
  const valid = trimmed.length >= 20 && trimmed.length <= 2000;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      await onSubmit({ category, message: trimmed });
      setMessage("");
      setStatus("sent");
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl }}
    >
      <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 44, alignSelf: "flex-start", justifyContent: "center" }}>
        <Text selectable style={[typography.label, { color: colors.gold }]}>Back</Text>
      </Pressable>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Send feedback</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>
          Report a bug, request a feature, or tell us what you think. We’ll reply by email.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }]}>Category</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {categories.map((item) => {
            const selected = item.value === category;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.value}
                onPress={() => setCategory(item.value)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: selected ? colors.gold : colors.border,
                  backgroundColor: selected ? colors.goldSoft : "transparent",
                }}
              >
                <Text selectable style={[typography.label, { color: selected ? colors.gold : colors.textSecondary }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase" }]}>Message</Text>
        <TextInput
          accessibilityLabel="Feedback message"
          maxLength={2000}
          multiline
          onChangeText={(value) => {
            setMessage(value);
            setStatus(null);
          }}
          placeholder="What happened, or what would make Formie better?"
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
          value={message}
          style={[typography.body, {
            minHeight: 180,
            padding: spacing.md,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.text,
            backgroundColor: colors.surface,
          }]}
        />
        <Text selectable style={[typography.caption, { color: trimmed.length > 2000 || (trimmed.length > 0 && trimmed.length < 20) ? colors.danger : colors.textMuted }]}>
          {trimmed.length}/2,000 · minimum 20 characters
        </Text>
      </View>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        Formie attaches only app version, build, platform, and OS version. Recordings, analyses, and device identifiers are never included.
      </Text>
      {status === "sent" ? <Text accessibilityRole="alert" selectable style={[typography.body, { color: colors.gold }]}>Thanks — your feedback was sent.</Text> : null}
      {status === "error" ? <Text accessibilityRole="alert" selectable style={[typography.body, { color: colors.danger }]}>Feedback could not be sent. Try again.</Text> : null}
      <FormButton
        label={busy ? "Sending…" : "Send feedback"}
        disabled={!valid || busy}
        onPress={() => void submit()}
      />
    </ScrollView>
  );
}
