import { Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { typography } from "@/theme/type";

type ScoreRingProps = {
  score: number;
  size?: number;
};

export function ScoreRing({ score, size = 156 }: ScoreRingProps) {
  return (
    <View
      accessibilityLabel={`Movement quality ${score} out of 100`}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: colors.gold,
        backgroundColor: colors.background,
      }}
    >
      <Text selectable style={[typography.display, { color: colors.text, fontVariant: ["tabular-nums"] }]}>
        {score}
      </Text>
      <Text selectable style={{ color: colors.gold, fontSize: 12, fontWeight: "600" }}>
        / 100
      </Text>
    </View>
  );
}
