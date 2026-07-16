import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { ProductionIcon } from "@/components/production-icon";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const setupArt = require("../../../assets/production/recording-setup.png");
const CHECKLIST = ["Keep the full movement visible", "Set the phone somewhere stable", "Use 0.5x if space is limited"] as const;

export function RecordingTipsScreen({ onContinue, onOpenSpaceHelp }: { onContinue: () => void; onOpenSpaceHelp: () => void }) {
  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl }}>
      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.xs }}><Text selectable style={[typography.title, { color: colors.text }]}>Record your full set.</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Keep the movement visible, then let FORM identify and coach the attempt.</Text></Animated.View>
      <View style={{ height: 232, overflow: "hidden", borderRadius: radii.md, backgroundColor: colors.surfaceRaised }}><Image accessibilityLabel="Phone placement from the production mockup" source={setupArt} contentFit="cover" style={{ width: "100%", height: "100%" }} /></View>
      <View style={{ gap: 0 }}>{CHECKLIST.map((item) => <View key={item} style={{ minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><ProductionIcon name="stageCheck" label="Complete" size={22} tintColor={colors.gold} /><Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{item}</Text></View>)}</View>
      <Pressable accessibilityRole="button" onPress={onOpenSpaceHelp} style={{ alignItems: "center", paddingVertical: spacing.sm }}><Text selectable style={[typography.label, { color: colors.gold }]}>No good place for your phone?</Text></Pressable>
      <View style={{ gap: spacing.sm }}><FormButton label="Continue to Camera" onPress={onContinue} /><Text selectable style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>By continuing, you consent to private video upload for AI form analysis.</Text></View>
    </ScrollView>
  );
}
