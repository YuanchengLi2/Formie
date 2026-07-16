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
        minWidth: size,
        alignItems: "baseline",
        justifyContent: "center",
        flexDirection: "row",
      }}
    >
      <Text selectable style={[typography.display, { color: colors.gold, fontVariant: ["tabular-nums"] }]}>
        {score}
      </Text>
      <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: "500" }}>
        / 100
      </Text>
    </View>
  );
}
