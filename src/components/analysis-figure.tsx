import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";

export function AnalysisFigure() {
  const scan = useSharedValue(0);
  useEffect(() => {
    scan.value = withRepeat(withTiming(1, { duration: 1_900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [scan]);
  const scanStyle = useAnimatedStyle(() => ({ opacity: interpolate(scan.value, [0, 0.5, 1], [0.2, 1, 0.2]), transform: [{ translateY: interpolate(scan.value, [0, 1], [-72, 72]) }] }));
  const jointStyle = useAnimatedStyle(() => ({ opacity: interpolate(scan.value, [0, 0.5, 1], [0.35, 1, 0.35]), transform: [{ scale: interpolate(scan.value, [0, 0.5, 1], [0.82, 1.12, 0.82]) }] }));

  return (
    <View accessibilityLabel="Formie analyzing visible movement" style={{ height: 236, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.textMuted }} />
        <View style={{ width: 74, height: 92, marginTop: 5, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.textMuted }} />
        <View style={{ position: "absolute", top: 54, left: -20, width: 58, height: 20, borderTopWidth: 1, borderColor: colors.textMuted, transform: [{ rotate: "-48deg" }] }} />
        <View style={{ position: "absolute", top: 53, right: -30, width: 62, height: 20, borderTopWidth: 1, borderColor: colors.textMuted, transform: [{ rotate: "40deg" }] }} />
        <View style={{ position: "absolute", top: 84, right: -40, width: 24, height: 34, borderWidth: 1, borderColor: colors.textMuted }} />
        <Animated.View style={[{ position: "absolute", top: 48, left: -26, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.gold }, jointStyle]} />
        <Animated.View style={[{ position: "absolute", top: 94, right: -22, width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: colors.gold }, jointStyle]} />
      </View>
      <Animated.View style={[{ position: "absolute", left: 24, right: 24, height: 1, backgroundColor: colors.gold }, scanStyle]} />
    </View>
  );
}
