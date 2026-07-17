import { useEffect, useState } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { analysisProgress } from "@/features/analysis/progress-stages";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const GENERATED_MOVEMENT_FRAMES = [
  require("../../assets/production/analysis-movement-frame-1.png"),
  require("../../assets/production/analysis-movement-frame-2.png"),
  require("../../assets/production/analysis-movement-frame-3.png"),
  require("../../assets/production/analysis-movement-frame-4.png"),
] as const;

export function AnalysisProgressMotion({ stage }: { stage: string | null }) {
  const scan = useSharedValue(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = analysisProgress(stage);

  useEffect(() => {
    scan.value = withRepeat(withTiming(1, { duration: 1_800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [scan]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setFrameIndex(0);
      return;
    }
    const timer = setInterval(() => setFrameIndex((current) => (current + 1) % GENERATED_MOVEMENT_FRAMES.length), 620);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const scanStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scan.value, [0, 0.16, 0.84, 1], [0, 0.95, 0.95, 0]),
    transform: [{ translateY: interpolate(scan.value, [0, 1], [-62, 62]) }],
  }));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="analysis-progress-native-motion"
      style={{ minHeight: 230, justifyContent: "space-between", gap: spacing.lg, padding: spacing.lg }}
    >
      <View style={{ minHeight: 174, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: "100%",
            maxWidth: 390,
            height: 190,
            overflow: "hidden",
            borderRadius: radii.lg,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <Image
            accessibilityLabel="Generated movement analysis animation"
            contentFit="cover"
            contentPosition={{ top: "43%" }}
            source={GENERATED_MOVEMENT_FRAMES[frameIndex]}
            style={{ position: "absolute", inset: 0 }}
            testID="analysis-generated-motion"
            transition={reduceMotion ? 0 : 180}
          />
          <View style={{ position: "absolute", inset: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: "rgba(200,169,107,0.34)" }} />
          <Animated.View style={[{ position: "absolute", left: spacing.sm, right: spacing.sm, top: "50%", height: 1, backgroundColor: colors.gold, boxShadow: "0 0 14px rgba(200,169,107,0.8)" }, scanStyle]} />
          <View style={{ position: "absolute", right: spacing.md, top: spacing.md, flexDirection: "row", gap: 4 }}>
            {[0, 1, 2].map((item) => <View key={item} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: item <= Math.min(2, Math.floor(progress.activeIndex / 2)) ? colors.gold : colors.textMuted }} />)}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs }}>
        {progress.items.map((item, index) => {
          const selected = item.state === "active";
          return (
            <View key={item.key} style={{ flex: 1, alignItems: "center", gap: spacing.xs }}>
              <View
                accessibilityState={{ selected }}
                testID={`analysis-motion-${item.key.replaceAll("_", "-")}`}
                style={{
                  width: selected ? 12 : 8,
                  height: selected ? 12 : 8,
                  borderRadius: 6,
                  borderWidth: item.state === "pending" ? 1 : 0,
                  borderColor: colors.textMuted,
                  backgroundColor: item.state === "pending" ? "transparent" : colors.gold,
                }}
              />
              {index < progress.items.length - 1 ? <View style={{ position: "absolute", left: "62%", right: "-38%", top: 5, height: 1, backgroundColor: item.state === "complete" ? colors.gold : colors.border }} /> : null}
              <Text selectable={false} numberOfLines={1} style={[typography.caption, { color: selected ? colors.gold : colors.textMuted }]}>{index + 1}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
