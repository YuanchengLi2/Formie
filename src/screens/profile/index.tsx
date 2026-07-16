import { ScrollView, Text, View } from "react-native";

import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

function InfoRow({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}>
      <View style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border }}>
        <Text selectable style={{ color: colors.gold, fontSize: 15 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable style={[typography.label, { color: colors.text }]}>{title}</Text>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>{detail}</Text>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 112 }}>
      <FormWordmark />
      <Text selectable style={[typography.title, { color: colors.text }]}>Profile</Text>

      <FormCard style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceRaised }}>
        <View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, borderWidth: 1, borderColor: colors.gold }}><Text selectable style={{ color: colors.gold, fontSize: 20 }}>F</Text></View>
        <View style={{ flex: 1, gap: 2 }}><Text selectable style={[typography.heading, { color: colors.text }]}>Private Guest</Text><Text selectable style={[typography.caption, { color: colors.textMuted }]}>This device</Text></View>
      </FormCard>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.8 }]}>PRIVACY</Text>
        <InfoRow icon="▣" title="Private by default" detail="Only you can access your recordings" />
        <InfoRow icon="▶" title="Video storage" detail="Original videos remain private" />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.caption, { color: colors.textMuted, letterSpacing: 0.8 }]}>HOW FORM WORKS</Text>
        <InfoRow icon="⌗" title="Complete-video analysis" detail="FORM reviews the recording as a whole" />
        <InfoRow icon="◌" title="Angle-tolerant coaching" detail="Only visible details are evaluated" />
      </View>

      <FormCard style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>How FORM analyzes</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Gemini reviews the complete recording at up to 24 sampled frames per second, recognizes the movement and camera view, and writes timestamped evidence-based coaching.</Text>
      </FormCard>

      <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Your FORM experience works without a public profile or manual exercise log.</Text>
      <Text selectable style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>FORM 1.0</Text>
    </ScrollView>
  );
}
