import { ScrollView, Text, View } from "react-native";

import { FormButton } from "@/components/form-button";
import { ProductionIcon, type ProductionIconName } from "@/components/production-icon";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const SOLUTIONS: [ProductionIconName, string][] = [["setupZoom", "Use 0.5x and move closer"], ["setupBag", "Lean it against a stable gym bag or bottle"], ["setupPerson", "Ask someone to hold it steadily"], ["completeVideo", "Use the rear camera when someone else can frame you"], ["warning", "Keep the phone out of walkways and off movable equipment"]];

export function NoPhoneSpaceScreen({ onDone }: { onDone: () => void }) {
  return <ScrollView bounces={false} overScrollMode="never" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.surfaceRaised }} contentContainerStyle={{ gap: spacing.lg, padding: spacing.xl, paddingBottom: spacing.xl }}>
    <View style={{ alignItems: "center", gap: spacing.xs }}><Text selectable style={[typography.heading, { color: colors.text }]}>No place for your phone?</Text><Text selectable style={[typography.caption, { color: colors.textSecondary }]}>Try one of these.</Text></View>
    <View>{SOLUTIONS.map(([icon, solution]) => <View key={solution} style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><ProductionIcon name={icon} label={solution} size={30} tintColor={colors.textSecondary} /><Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{solution}</Text></View>)}</View>
    <Text selectable style={[typography.caption, { color: colors.gold, textAlign: "center" }]}>Good enough to see is good enough to try.</Text><FormButton label="Got It" onPress={onDone} />
  </ScrollView>;
}
