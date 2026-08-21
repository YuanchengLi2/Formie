import { useEffect, useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Body, { type ExtendedBodyPart } from "react-native-body-highlighter";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import {
  muscleMapHighlightsForFace,
  preferredMuscleMapFace,
  type MuscleMapHighlightKind,
} from "@/components/muscle-map-regions";
import { snappedMuscleMapRotation } from "@/components/muscle-map-rotation";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";

export type AnatomyModelProps = {
  targetRegions: MuscleRegion[];
  secondaryRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
  mode?: "muscles" | "form";
};

const HIGHLIGHT_STYLE: Record<MuscleMapHighlightKind, { fill: string; stroke: string }> = {
  target: { fill: colors.gold, stroke: "#F1D9A6" },
  secondary: { fill: colors.goldPressed, stroke: "#D8B778" },
  issue: { fill: colors.danger, stroke: "#FFAAA2" },
};

const SPRING = {
  duration: 400,
  dampingRatio: 0.8,
  reduceMotion: ReduceMotion.System,
} as const;

function bodyData(highlights: ReturnType<typeof muscleMapHighlightsForFace>): ExtendedBodyPart[] {
  return highlights.map(({ slug, kind }) => ({
    slug,
    styles: {
      fill: HIGHLIGHT_STYLE[kind].fill,
      stroke: HIGHLIGHT_STYLE[kind].stroke,
      strokeWidth: 1.8,
    },
  }));
}

export function AnatomyModel({ targetRegions, secondaryRegions, issueRegions }: AnatomyModelProps) {
  const { width } = useWindowDimensions();
  const regionKey = `${targetRegions.join(",")}|${secondaryRegions.join(",")}|${issueRegions.join(",")}`;
  const preferredFace = preferredMuscleMapFace(targetRegions, secondaryRegions, issueRegions);
  const rotation = useSharedValue(preferredFace === "back" ? Math.PI : 0);
  const gestureStart = useSharedValue(rotation.value);
  const gestureWidth = Math.max(240, Math.min(width - spacing.xl * 2, 420));
  const scale = width < 350 ? 0.83 : width < 600 ? 0.97 : 1.08;

  useEffect(() => {
    rotation.value = withSpring(preferredFace === "back" ? Math.PI : 0, SPRING);
    // The joined region key deliberately resets the face only when the actual highlights change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionKey, preferredFace]);

  const frontHighlights = useMemo(
    () => muscleMapHighlightsForFace("front", targetRegions, secondaryRegions, issueRegions),
    [issueRegions, secondaryRegions, targetRegions],
  );
  const backHighlights = useMemo(
    () => muscleMapHighlightsForFace("back", targetRegions, secondaryRegions, issueRegions),
    [issueRegions, secondaryRegions, targetRegions],
  );
  const frontData = useMemo(() => bodyData(frontHighlights), [frontHighlights]);
  const backData = useMemo(() => bodyData(backHighlights), [backHighlights]);
  const highlightSlugs = useMemo(
    () => Array.from(new Set([...frontHighlights, ...backHighlights].map(({ slug }) => slug))),
    [backHighlights, frontHighlights],
  );

  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-22, 22])
    .onBegin(() => {
      gestureStart.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = gestureStart.value + (event.translationX / gestureWidth) * Math.PI;
    })
    .onEnd((event) => {
      const destination = snappedMuscleMapRotation(gestureStart.value, event.translationX, event.velocityX, gestureWidth);
      rotation.value = withSpring(destination, { ...SPRING, velocity: event.velocityX / gestureWidth });
    }), [gestureStart, gestureWidth, rotation]);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: Math.cos(rotation.value) >= 0 ? 1 : 0,
    transform: [
      { perspective: 900 },
      { rotateY: `${rotation.value}rad` },
      { scale: 0.97 + Math.abs(Math.cos(rotation.value)) * 0.03 },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: Math.cos(rotation.value) < 0 ? 1 : 0,
    transform: [
      { perspective: 900 },
      { rotateY: `${rotation.value + Math.PI}rad` },
      { scale: 0.97 + Math.abs(Math.cos(rotation.value)) * 0.03 },
    ],
  }));

  const rotateByAccessibility = (direction: -1 | 1) => {
    const destination = snappedMuscleMapRotation(rotation.value, direction * gestureWidth, direction * 900, gestureWidth);
    rotation.value = withSpring(destination, SPRING);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <GestureDetector gesture={panGesture}>
        <View
          accessibilityActions={[{ name: "increment", label: "Rotate right" }, { name: "decrement", label: "Rotate left" }]}
          accessibilityHint="Swipe horizontally to turn the body between front and back views."
          accessibilityLabel="Rotatable muscle map"
          accessibilityRole="adjustable"
          onAccessibilityAction={({ nativeEvent }) => rotateByAccessibility(nativeEvent.actionName === "decrement" ? -1 : 1)}
          testID="anatomy-gesture-surface"
          style={{ minHeight: 430, alignItems: "center", justifyContent: "center", overflow: "hidden", paddingVertical: spacing.md, borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <View pointerEvents="none" style={{ position: "absolute", width: 240, height: 340, opacity: 0.42, borderRadius: 120, backgroundColor: colors.goldSoft, transform: [{ scaleX: 1.2 }] }} />
          <View testID="native-muscle-map" style={{ width: 250, height: 400, alignItems: "center", justifyContent: "center" }}>
            <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden" }, frontStyle]}>
              <Body border={colors.textMuted} data={frontData} defaultFill={colors.surfaceRaised} defaultStroke={colors.textMuted} defaultStrokeWidth={1.1} gender="male" scale={scale} side="front" />
            </Animated.View>
            <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden" }, backStyle]}>
              <Body border={colors.textMuted} data={backData} defaultFill={colors.surfaceRaised} defaultStroke={colors.textMuted} defaultStrokeWidth={1.1} gender="male" scale={scale} side="back" />
            </Animated.View>
          </View>
          {highlightSlugs.map((slug) => <View key={slug} pointerEvents="none" testID={`muscle-map-native-highlight-${slug}`} />)}
          {targetRegions.map((region) => <View key={`target-${region}`} pointerEvents="none" testID={`anatomy-target-${region}`} />)}
          {secondaryRegions.map((region) => <View key={`secondary-${region}`} pointerEvents="none" testID={`anatomy-secondary-${region}`} />)}
          {issueRegions.map((region) => <View key={`issue-${region}`} pointerEvents="none" testID={`anatomy-issue-${region}`} />)}
        </View>
      </GestureDetector>
    </View>
  );
}
