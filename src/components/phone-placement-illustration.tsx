import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export function PhonePlacementIllustration() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
        withDelay(900, withTiming(1, { duration: 1 })),
        withTiming(0, { duration: 650, easing: Easing.inOut(Easing.quad) }),
        withDelay(350, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const phoneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 0.45, 1], [-18, -5, 0]) },
      { rotate: `${interpolate(progress.value, [0, 1], [-13, -4])}deg` },
    ],
  }));

  const personStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35, 1], [0.35, 0.55, 1]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [24, 0]) }],
  }));

  return (
    <View
      accessibilityLabel="General phone placement animation"
      style={{
        height: 220,
        overflow: "hidden",
        borderRadius: radii.lg,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ position: "absolute", left: 22, right: 22, bottom: 38, height: 1, backgroundColor: colors.border }} />
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 34,
            bottom: 48,
            width: 38,
            height: 72,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: colors.gold,
            backgroundColor: colors.cameraBlack,
          },
          phoneStyle,
        ]}
      >
        <View style={{ alignSelf: "center", width: 8, height: 8, marginTop: 5, borderRadius: 4, backgroundColor: colors.gold }} />
      </Animated.View>
      <View style={{ position: "absolute", left: 28, bottom: 32, width: 60, height: 18, borderRadius: 9, backgroundColor: colors.surfaceRaised }} />

      <Animated.View style={[{ position: "absolute", right: 48, bottom: 42, alignItems: "center" }, personStyle]}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.textSecondary }} />
        <View style={{ width: 44, height: 76, marginTop: 5, borderRadius: 20, backgroundColor: colors.textSecondary }} />
        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: -8 }}>
          <View style={{ width: 13, height: 65, borderRadius: 7, backgroundColor: colors.textSecondary, transform: [{ rotate: "8deg" }] }} />
          <View style={{ width: 13, height: 65, borderRadius: 7, backgroundColor: colors.textSecondary, transform: [{ rotate: "-8deg" }] }} />
        </View>
      </Animated.View>

      <View style={{ position: "absolute", left: 88, right: 98, top: 58, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.gold, transform: [{ rotate: "-8deg" }] }} />
      <Text selectable style={[typography.caption, { position: "absolute", left: 18, right: 18, bottom: 10, color: colors.textSecondary, textAlign: "center" }]}>Stable phone · full movement visible</Text>
    </View>
  );
}
