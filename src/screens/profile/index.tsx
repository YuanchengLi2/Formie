import { ScrollView, Text, View } from "react-native";

import { FormCard } from "@/components/form-card";
import { FormWordmark } from "@/components/form-wordmark";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export function ProfileScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingTop: spacing.xxl }}
    >
      <FormWordmark />
      <Text selectable style={[typography.title, { color: colors.text }]}>Profile</Text>
      <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Your FORM experience works without a public profile or manual exercise log.</Text>

      <FormCard style={{ gap: spacing.md }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>Private by default</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Your recordings and results are tied to a private guest account on this device. Other FORM users cannot browse them.</Text>
        <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Original videos and structured results remain in private storage and are never part of a public profile.</Text>
      </FormCard>

      <FormCard style={{ gap: spacing.lg }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>How FORM analyzes</Text>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={[typography.label, { color: colors.gold }]}>GEMINI</Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Gemini reviews the complete recording at up to 24 sampled frames per second, recognizes the movement and camera view, and writes timestamped evidence-based coaching.</Text>
        </View>
      </FormCard>

      <FormCard style={{ gap: spacing.sm, borderColor: colors.goldSoft }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>Angle-tolerant coaching</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>FORM analyzes what front, side, diagonal, elevated, and low views actually reveal. It leaves out claims the camera cannot support instead of inventing an unseen viewpoint.</Text>
      </FormCard>
    </ScrollView>
  );
}
