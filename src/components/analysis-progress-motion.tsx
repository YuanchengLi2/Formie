import { useEffect } from "react";
import { Text, View } from "react-native";
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

const TRACE_POINTS = [
  { left: "18%" as const, top: "67%" as const, delay: 0 },
  { left: "43%" as const, top: "34%" as const, delay: 0.28 },
  { left: "70%" as const, top: "54%" as const, delay: 0.56 },
] as const;

export function AnalysisProgressMotion({ stage }: { stage: string | null }) {
  const scan = useSharedValue(0);
  const pulse = useSharedValue(0);
  const progress = analysisProgress(stage);

  useEffect(() => {
    scan.value = withRepeat(withTiming(1, { duration: 1_800, easing: Easing.inOut(Easing.quad) }), -1, true);
    pulse.value = withRepeat(withTiming(1, { duration: 1_200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse, scan]);

  const scanStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scan.value, [0, 0.16, 0.84, 1], [0, 0.95, 0.95, 0]),
    transform: [{ translateY: interpolate(scan.value, [0, 1], [-62, 62]) }],
  }));
  const pathStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.5, 1], [0.34, 0.92, 0.34]),
    transform: [{ scaleX: interpolate(pulse.value, [0, 0.5, 1], [0.94, 1, 0.94]) }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="analysis-progress-native-motion"
      style={{ minHeight: 230, justifyContent: "space-between", gap: spacing.lg, padding: spacing.lg }}
    >
      <View style={{ minHeight: 154, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: "78%",
            maxWidth: 330,
            height: 142,
            overflow: "hidden",
            borderRadius: radii.lg,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ position: "absolute", inset: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: "rgba(200,169,107,0.18)" }} />
          <Animated.View
            style={[
              { position: "absolute", left: "14%", right: "14%", top: "50%", height: 1, backgroundColor: colors.gold },
              pathStyle,
            ]}
          />
          <View style={{ position: "absolute", left: "20%", top: "50%", width: "25%", height: 1, backgroundColor: colors.gold, transform: [{ rotate: "-28deg" }] }} />
          <View style={{ position: "absolute", left: "45%", top: "47%", width: "28%", height: 1, backgroundColor: colors.gold, transform: [{ rotate: "22deg" }] }} />
          {TRACE_POINTS.map((point, index) => (
            <Animated.View
              key={`${point.left}-${point.top}`}
              style={{
                position: "absolute",
                left: point.left,
                top: point.top,
                width: index === 1 ? 16 : 12,
                height: index === 1 ? 16 : 12,
                borderRadius: index === 1 ? 8 : 6,
                borderWidth: 2,
                borderColor: colors.gold,
                backgroundColor: index === 1 ? colors.goldSoft : colors.background,
                opacity: 1 - point.delay * 0.35,
              }}
            />
          ))}
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
