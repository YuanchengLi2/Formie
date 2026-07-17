import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { ProductionMotion } from "@/components/production-motion";
import { ProductionIcon } from "@/components/production-icon";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

const CHECKLIST = ["Keep the full movement visible", "Capture most of your body or the area you want coached", "Set the phone somewhere stable", "Use 0.5x if space is limited"] as const;

export function RecordingTipsScreen({ onContinue, onOpenSpaceHelp }: { onContinue: () => void; onOpenSpaceHelp: () => void }) {
  return (
    <ScrollView alwaysBounceVertical bounces overScrollMode="auto" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl }}>
      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.xs }}><Text selectable style={[typography.title, { color: colors.text }]}>Record your full set.</Text><Text selectable style={[typography.body, { color: colors.textSecondary }]}>Keep the movement visible, then let FORM identify and coach the attempt.</Text></Animated.View>
      <Animated.View entering={FadeInDown.delay(50).duration(240)} layout={LinearTransition.duration(180)} testID="recording-tips-motion-card" style={{ height: 232, overflow: "hidden", borderRadius: radii.md, borderCurve: "continuous", backgroundColor: colors.surfaceRaised }}><ProductionMotion kind="cameraSetup" accessibilityLabel="Animated phone placement guide" style={{ width: "100%", height: "100%" }} /></Animated.View>
      <View style={{ gap: 0 }}>{CHECKLIST.map((item, index) => <Animated.View entering={FadeInDown.delay(90 + index * 45).duration(220)} key={item} layout={LinearTransition.duration(180)} testID={`recording-tip-row-${index}`} style={{ minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><ProductionIcon name="stageCheck" label="Complete" size={22} tintColor={colors.gold} /><Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{item}</Text></Animated.View>)}</View>
      <Animated.View entering={FadeInDown.delay(280).duration(220)}><Pressable accessibilityRole="button" onPress={onOpenSpaceHelp} style={{ alignItems: "center", paddingVertical: spacing.sm }}><Text selectable style={[typography.label, { color: colors.gold }]}>No good place for your phone?</Text></Pressable></Animated.View>
      <Animated.View entering={FadeInDown.delay(320).duration(220)} style={{ gap: spacing.sm }}><FormButton label="Continue to Camera" onPress={onContinue} /><Text selectable style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>By continuing, you consent to private video upload for AI form analysis.</Text></Animated.View>
    </ScrollView>
  );
}
