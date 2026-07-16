import { View } from "react-native";

import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";

function Corner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const top = position.startsWith("t") ? 18 : undefined;
  const bottom = position.startsWith("b") ? 18 : undefined;
  const left = position.endsWith("l") ? 18 : undefined;
  const right = position.endsWith("r") ? 18 : undefined;
  return (
    <View
      style={{
        position: "absolute",
        top,
        bottom,
        left,
        right,
        width: 22,
        height: 22,
        borderTopWidth: position.startsWith("t") ? 1 : 0,
        borderBottomWidth: position.startsWith("b") ? 1 : 0,
        borderLeftWidth: position.endsWith("l") ? 1 : 0,
        borderRightWidth: position.endsWith("r") ? 1 : 0,
        borderColor: colors.textSecondary,
      }}
    />
  );
}

export function MovementFrame({ height = 176 }: { height?: number }) {
  return (
    <View
      accessibilityLabel="Exercise movement framing illustration"
      style={{ height, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: radii.md, backgroundColor: colors.surfaceRaised }}
    >
      <Corner position="tl" />
      <Corner position="tr" />
      <Corner position="bl" />
      <Corner position="br" />
      <View style={{ alignItems: "center", transform: [{ translateY: 3 }] }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.textSecondary }} />
        <View style={{ width: 1, height: 38, backgroundColor: colors.textSecondary }} />
        <View style={{ position: "absolute", top: 31, width: 72, height: 1, backgroundColor: colors.textSecondary }} />
        <View style={{ flexDirection: "row", gap: 22 }}>
          <View style={{ width: 1, height: 34, backgroundColor: colors.textSecondary, transform: [{ rotate: "18deg" }] }} />
          <View style={{ width: 1, height: 34, backgroundColor: colors.textSecondary, transform: [{ rotate: "-18deg" }] }} />
        </View>
        <View style={{ position: "absolute", top: 27, left: -43, width: 12, height: 12, borderRadius: 2, borderWidth: 1, borderColor: colors.gold }} />
        <View style={{ position: "absolute", top: 27, right: -43, width: 12, height: 12, borderRadius: 2, borderWidth: 1, borderColor: colors.gold }} />
      </View>
    </View>
  );
}
