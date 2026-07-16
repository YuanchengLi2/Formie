import { ScrollView, Text, View } from "react-native";

import { FormButton } from "@/components/form-button";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const SOLUTIONS = [
  ["0.5×", "Use 0.5x and move closer"],
  ["▣", "Lean it against a stable personal item"],
  ["○", "Ask someone to hold it steadily"],
  ["⌁", "Place it on a bench and tilt it with a soft item"],
  ["△", "Use a compact folding phone stand"],
] as const;

export function NoPhoneSpaceScreen({ onDone }: { onDone: () => void }) {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.surfaceRaised }} contentContainerStyle={{ gap: spacing.xl, padding: spacing.xl, paddingBottom: spacing.xxxl }}>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <Text selectable style={[typography.heading, { color: colors.text }]}>No place for your phone?</Text>
        <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Try one of these.</Text>
      </View>
      <View style={{ gap: 0 }}>
        {SOLUTIONS.map(([icon, solution]) => (
          <View key={solution} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text selectable style={[typography.label, { width: 28, color: colors.gold, textAlign: "center" }]}>{icon}</Text>
            <Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{solution}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
        <Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Keep your phone out of walkways and off movable equipment.</Text>
        <Text selectable style={[typography.caption, { color: colors.gold, textAlign: "center" }]}>Good enough to see is good enough to try.</Text>
      </View>
      <FormButton label="Got It" onPress={onDone} />
    </ScrollView>
  );
}
