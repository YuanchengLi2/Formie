import { Image } from "expo-image";
import { View } from "react-native";

import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";

const analysisArt = require("../../assets/production/analysis-figure.png");

export function AnalysisFigure() {
  return <View accessibilityLabel="FORM analyzing visible movement" style={{ height: 252, overflow: "hidden", borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised }}><Image source={analysisArt} contentFit="cover" style={{ width: "100%", height: "100%" }} /></View>;
}
