import { ScrollView, Text } from "react-native";

import { FormWordmark } from "@/components/form-wordmark";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export function ProgressScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingTop: spacing.xxl }}
    >
      <FormWordmark />
      <Text selectable style={[typography.title, { color: colors.text }]}>Progress</Text>
      <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Your completed form analyses will appear here.</Text>
    </ScrollView>
  );
}
