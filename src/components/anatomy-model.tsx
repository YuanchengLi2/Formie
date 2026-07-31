import { useCallback, useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";

import { AnatomyInteractionSurface } from "@/components/anatomy-interaction-surface";
import {
  anatomyRotationFromDrag,
  normalizedAnatomyRotation,
} from "@/components/anatomy-rotation";
import { AnatomyRotationControl } from "@/components/anatomy-rotation-control";
import type { AnatomyRegion, MuscleRegion } from "@/features/analysis/result-schema";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";

export type AnatomyModelProps = {
  targetRegions: MuscleRegion[];
  issueRegions: AnatomyRegion[];
};

export function AnatomyModel({ targetRegions, issueRegions }: AnatomyModelProps) {
  const [rotation, setRotation] = useState(0);
  const progress = normalizedAnatomyRotation(rotation);
  const backFacing = progress >= 0.25 && progress < 0.75;
  const rotate = useCallback((deltaX: number) => {
    setRotation((current) => anatomyRotationFromDrag(current, deltaX));
  }, []);

  return (
    <View style={{ gap: spacing.sm }}>
      <AnatomyInteractionSurface
        accessibilityLabel="Rotatable anatomy model"
        accessibilityRole="adjustable"
        onRotate={rotate}
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
        {targetRegions.map((region) => (
          <View key={`target-${region}`} pointerEvents="none" testID={`anatomy-target-${region}`} />
        ))}
        {issueRegions.map((region) => (
          <View key={`issue-${region}`} pointerEvents="none" testID={`anatomy-issue-${region}`} />
        ))}
      </AnatomyInteractionSurface>
      <AnatomyRotationControl rotation={rotation} onChange={setRotation} />
    </View>
  );
}
