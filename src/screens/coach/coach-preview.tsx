import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export function CoachPreviewScreen() {
  const insets = useSafeAreaInsets();

  return <View style={{ flex: 1, paddingTop: insets.top, paddingHorizontal: spacing.xl, paddingBottom: Math.max(insets.bottom, spacing.xl), justifyContent: "center", backgroundColor: colors.background }}>
    <View testID="coach-preview-card" style={{ gap: spacing.lg, padding: spacing.xl, borderRadius: radii.lg, borderWidth: 1, borderColor: "rgba(200,169,107,0.38)", backgroundColor: colors.surface }}>
      <View style={{ alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 999, backgroundColor: colors.goldSoft }}><Text style={[typography.caption, { color: colors.gold, fontWeight: "800", letterSpacing: 1.2 }]}>PREVIEW</Text></View>
      <View style={{ gap: spacing.sm }}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>Formie Coach</Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>A future space for discussing completed analyses and planning what to focus on next.</Text>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <Text style={[typography.body, { color: colors.gold, fontWeight: "700" }]}>Preview — not included in Formie Pro yet</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>This preview has no chat, picker, or other interactive coaching controls.</Text>
    </View>
  </View>;
}
