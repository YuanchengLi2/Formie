import { useEffect, useMemo, useState } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import Body, { type ExtendedBodyPart } from "react-native-body-highlighter";

import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import {
  muscleMapHighlightsForFace,
  preferredMuscleMapFace,
  type MuscleMapFace,
  type MuscleMapHighlightKind,
} from "@/components/muscle-map-regions";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

export type AnatomyModelProps = {
  targetRegions: MuscleRegion[];
  secondaryRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
  mode?: "muscles" | "form";
};

const HIGHLIGHT_STYLE: Record<MuscleMapHighlightKind, { fill: string; stroke: string }> = {
  target: { fill: "#35D07F", stroke: "#8CF0B8" },
  secondary: { fill: "#F05A5A", stroke: "#FF9696" },
  issue: { fill: "#F1B542", stroke: "#FFE09A" },
};

export function AnatomyModel({ targetRegions, secondaryRegions, issueRegions }: AnatomyModelProps) {
  const { width } = useWindowDimensions();
  const regionKey = `${targetRegions.join(",")}|${secondaryRegions.join(",")}|${issueRegions.join(",")}`;
  const preferredFace = preferredMuscleMapFace(targetRegions, secondaryRegions, issueRegions);
  const [face, setFace] = useState<MuscleMapFace>(preferredFace);
  const scale = width < 350 ? 0.82 : width < 600 ? 0.96 : 1.08;

  useEffect(() => {
    setFace(preferredFace);
    // Reset only when the actual highlighted regions change, not when array identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionKey]);

  const highlights = useMemo(
    () => muscleMapHighlightsForFace(face, targetRegions, secondaryRegions, issueRegions),
    [face, issueRegions, secondaryRegions, targetRegions],
  );
  const data = useMemo<ExtendedBodyPart[]>(
    () => highlights.map(({ slug, kind }) => ({
      slug,
      styles: {
        fill: HIGHLIGHT_STYLE[kind].fill,
        stroke: HIGHLIGHT_STYLE[kind].stroke,
        strokeWidth: 2,
      },
    })),
    [highlights],
  );

  return (
    <View accessibilityLabel="Front and back muscle map" style={{ gap: spacing.sm }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 3, borderRadius: radii.md, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        {(["front", "back"] as const).map((value) => {
          const selected = face === value;
          return (
            <Pressable key={value} accessibilityLabel={`${value === "front" ? "Front" : "Back"} anatomy`} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setFace(value)} style={{ flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, backgroundColor: selected ? colors.gold : "transparent" }}>
              <Text selectable style={[typography.label, { color: selected ? colors.background : colors.textSecondary }]}>{value === "front" ? "Front" : "Back"}</Text>
            </Pressable>
          );
        })}
      </View>

      <View testID="anatomy-gesture-surface" style={{ minHeight: 420, alignItems: "center", justifyContent: "center", overflow: "hidden", paddingVertical: spacing.md, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
        <View testID="native-muscle-map">
          <Body border="#756D65" data={data} defaultFill="#4D4946" defaultStroke="#756D65" defaultStrokeWidth={1} gender="male" scale={scale} side={face} />
        </View>
        {highlights.map(({ slug }) => <View key={slug} pointerEvents="none" testID={`muscle-map-native-highlight-${slug}`} />)}
        {targetRegions.map((region) => <View key={`target-${region}`} pointerEvents="none" testID={`anatomy-target-${region}`} />)}
        {secondaryRegions.map((region) => <View key={`secondary-${region}`} pointerEvents="none" testID={`anatomy-secondary-${region}`} />)}
        {issueRegions.map((region) => <View key={`issue-${region}`} pointerEvents="none" testID={`anatomy-issue-${region}`} />)}
      </View>
    </View>
  );
}
