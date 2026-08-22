import { Text, View } from "react-native";

import { FormButton } from "@/components/form-button";
import { ProductionIcon, type ProductionIconName } from "@/components/production-icon";
import { ResponsiveScreen } from "@/components/responsive-screen";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const SOLUTIONS: [ProductionIconName, string][] = [["setupZoom", "Use 0.5x and move closer"], ["setupBag", "Lean it against a stable gym bag or bottle"], ["setupPerson", "Ask someone to hold it steadily"], ["completeVideo", "Use the rear camera when someone else can frame you"], ["warning", "Keep the phone out of walkways and off movable equipment"]];

export function NoPhoneSpaceScreen({ onDone }: { onDone: () => void }) {
  return <ResponsiveScreen testID="no-phone-space-responsive-screen" style={{ backgroundColor: colors.surfaceRaised }} contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.lg }}>
    <View style={{ alignItems: "center" }}><Text selectable style={[typography.heading, { color: colors.text }]}>No place for your phone?</Text></View>
    <View>{SOLUTIONS.map(([icon, solution]) => <View key={solution} style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><ProductionIcon name={icon} label={solution} size={30} tintColor={colors.textSecondary} /><Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{solution}</Text></View>)}</View>
    <FormButton label="Got It" onPress={onDone} />
  </ResponsiveScreen>;
}
