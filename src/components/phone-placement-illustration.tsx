import { View } from "react-native";

import { ProductionMotion } from "@/components/production-motion";
import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";

export function PhonePlacementIllustration() {
  return (
    <View
      style={{
        height: 210,
        overflow: "hidden",
        borderRadius: radii.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <ProductionMotion
        accessibilityLabel="General phone placement animation"
        kind="cameraSetup"
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
