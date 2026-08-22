import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";

import { analysisProgress } from "@/features/analysis/progress-stages";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";
import { usePhoneLayoutProfile } from "@/theme/responsive";

const GENERATED_MOVEMENT_FRAMES = [
  require("../../assets/production/analysis-curl-frame-1.png"),
  require("../../assets/production/analysis-curl-frame-2.png"),
  require("../../assets/production/analysis-curl-frame-3.png"),
] as const;

const CONTINUOUS_FRAME_SEQUENCE = [0, 1, 2, 1] as const;

export function AnalysisProgressMotion({ stage }: { stage: string | null }) {
  const layout = usePhoneLayoutProfile();
  const frameHeight = Math.min(310, Math.max(190, layout.artworkMaxHeight * 0.62));
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const frameIndex = CONTINUOUS_FRAME_SEQUENCE[sequenceIndex];
  const progress = analysisProgress(stage);

  useEffect(() => {
    const timer = setInterval(() => setSequenceIndex((current) => (current + 1) % CONTINUOUS_FRAME_SEQUENCE.length), 620);
    return () => clearInterval(timer);
  }, []);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="analysis-progress-native-motion"
      style={{ minHeight: frameHeight + 40, justifyContent: "space-between", gap: spacing.md, paddingVertical: spacing.sm }}
    >
      <View style={{ minHeight: frameHeight, alignItems: "center", justifyContent: "center" }}>
        <View
          testID="analysis-frame-surface"
          style={{
            width: "100%",
            maxWidth: 520,
            height: frameHeight,
            overflow: "hidden",
            backgroundColor: colors.background,
          }}
        >
          <View testID="analysis-frame-blend-layer" style={{ position: "absolute", inset: 0, mixBlendMode: "lighten" }}>
            <Image
              accessibilityLabel={`Curl analysis frame ${frameIndex + 1} of 3`}
              contentFit="contain"
              source={GENERATED_MOVEMENT_FRAMES[frameIndex]}
              style={{ position: "absolute", inset: 0, transform: [{ translateY: frameIndex === 2 ? 5 : 0 }] }}
              testID="analysis-generated-motion"
              transition={360}
            />
          </View>
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
