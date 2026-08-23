import { View } from "react-native";

import { MuscleFocusFigure } from "@/components/muscle-focus-figure";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

export function AnalysisRuntimeSmoke() {
  return (
    <View
      testID="analysis-runtime-smoke"
      style={{ flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.background }}
    >
      <MuscleFocusFigure
        focus={{
          primary: [{ name: "Chest", region: "chest" }],
          secondary: [{ name: "Triceps", region: "triceps" }],
          unclassified: [],
        }}
        issueRegions={["shoulders"]}
      />
    </View>
  );
}
