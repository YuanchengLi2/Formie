import { useCallback, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";

import { AnatomyInteractionSurface } from "@/components/anatomy-interaction-surface";
import {
  anatomyRotationFromDrag,
  normalizedAnatomyRotation,
} from "@/components/anatomy-rotation";
import { AnatomyRotationControl } from "@/components/anatomy-rotation-control";
import { nextAnatomyZoom } from "@/components/anatomy-zoom";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";

export type AnatomyModelProps = {
  targetRegions: MuscleRegion[];
  secondaryRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
  mode?: "muscles" | "form";
};

export function AnatomyModel({ targetRegions, secondaryRegions, issueRegions, mode = "muscles" }: AnatomyModelProps) {
  const [rotation, setRotation] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const progress = normalizedAnatomyRotation(rotation);
  const backFacing = progress >= 0.25 && progress < 0.75;
  const rotate = useCallback((deltaX: number) => {
    setRotation((current) => anatomyRotationFromDrag(current, deltaX));
  }, []);
  const zoom = useCallback((scale: number) => {
    setZoomLevel((current) => nextAnatomyZoom(current, scale));
  }, []);

  return (
    <View style={{ gap: spacing.sm }}>
      <AnatomyInteractionSurface
        accessibilityLabel="Rotatable anatomy model"
        accessibilityRole="adjustable"
        onRotate={rotate}
        onZoom={zoom}
        testID="anatomy-gesture-surface"
        style={{
          width: "100%",
          aspectRatio: 728 / 1090,
          overflow: "hidden",
          borderRadius: radii.lg,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        {mode === "form" ? <View pointerEvents="none" testID="anatomy-surface-highlight-mode" /> : null}
        <View style={{ position: "absolute", inset: 0, transform: [{ scale: zoomLevel }] }}>
          <Image
            accessibilityLabel={`${backFacing ? "Back" : "Front"} anatomical muscle figure`}
            contentFit="fill"
            source={require("../../assets/production/anatomy-body-front-back.png")}
            testID="anatomy-body-image"
            style={{
              position: "absolute",
              inset: 0,
              left: backFacing ? "-100%" : "0%",
              width: "200%",
              height: "100%",
            }}
          />
        </View>
        {targetRegions.map((region) => (
          <View key={`target-${region}`} pointerEvents="none" testID={`anatomy-target-${region}`} />
        ))}
        {secondaryRegions.map((region) => (
          <View key={`secondary-${region}`} pointerEvents="none" testID={`anatomy-secondary-${region}`} />
        ))}
        {issueRegions.map((region) => (
          <View key={`issue-${region}`} pointerEvents="none" testID={`anatomy-issue-${region}`} />
        ))}
      </AnatomyInteractionSurface>
      <AnatomyRotationControl rotation={rotation} onChange={setRotation} />
    </View>
  );
}
