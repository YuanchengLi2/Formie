import { ScrollView, Text, View } from "react-native";

import { FormCard } from "@/components/form-card";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const SOLUTIONS = [
  "Switch to 0.5x and place the phone closer.",
  "Lean the phone horizontally against a stable personal item.",
  "Place it on a bench and tilt it using a soft personal item.",
  "Ask a training partner to hold it steadily.",
  "Use a compact folding phone stand.",
];

export function NoPhoneSpaceScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxxl }}
    >
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>No good place for your phone?</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Try the easiest safe option available. FORM is designed to work with imperfect setups.</Text>
      </View>

      <View style={{ gap: spacing.md }}>
        {SOLUTIONS.map((solution, index) => (
          <FormCard key={solution} style={{ flexDirection: "row", alignItems: "center" }}>
            <Text selectable style={[typography.label, { color: colors.gold }]}>{index + 1}</Text>
            <Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{solution}</Text>
          </FormCard>
        ))}
      </View>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Avoid movable gym equipment, shared equipment, and anywhere the phone could enter another person&apos;s path.</Text>

      <FormCard style={{ backgroundColor: colors.goldSoft, borderColor: colors.gold }}>
        <Text selectable style={[typography.heading, { color: colors.gold, textAlign: "center" }]}>Good enough to see is good enough to try.</Text>
      </FormCard>
    </ScrollView>
  );
}
