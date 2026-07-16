import { Image, type ImageSource } from "expo-image";
import type { StyleProp, ImageStyle } from "react-native";

import type { ExerciseFamily } from "@/features/exercises/exercise-family";
import { colors } from "@/theme/colors";

const familySources: Record<ExerciseFamily, ImageSource> = {
  curl: require("../../assets/production/exercise-families/curl.png"),
  triceps: require("../../assets/production/exercise-families/triceps.png"),
  press: require("../../assets/production/exercise-families/press.png"),
  "overhead-press": require("../../assets/production/exercise-families/overhead-press.png"),
  fly: require("../../assets/production/exercise-families/fly.png"),
  raise: require("../../assets/production/exercise-families/raise.png"),
  row: require("../../assets/production/exercise-families/row.png"),
  "pull-down": require("../../assets/production/exercise-families/pull-down.png"),
  squat: require("../../assets/production/exercise-families/squat.png"),
  lunge: require("../../assets/production/exercise-families/lunge.png"),
  hinge: require("../../assets/production/exercise-families/hinge.png"),
  "hip-thrust": require("../../assets/production/exercise-families/hip-thrust.png"),
  carry: require("../../assets/production/exercise-families/carry.png"),
  core: require("../../assets/production/exercise-families/core.png"),
  plank: require("../../assets/production/exercise-families/plank.png"),
  other: require("../../assets/production/exercise-families/other.png"),
};

export function ExerciseFamilyIcon({ family, size = 54, style }: { family: ExerciseFamily; size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      accessibilityLabel={`${family} exercise icon`}
      contentFit="contain"
      source={familySources[family]}
      style={[{ width: size, height: size }, style]}
      tintColor={colors.textSecondary}
    />
  );
}
