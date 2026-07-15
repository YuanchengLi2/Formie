import { ScrollView, Text, View } from "react-native";

import { FormWordmark } from "@/components/form-wordmark";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export function HomeScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: 120 }}
    >
      <FormWordmark />
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { color: colors.text, maxWidth: 280 }]}>
          Ready to improve today?
        </Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>
          Choose an exercise to begin.
        </Text>
      </View>
    </ScrollView>
  );
}
