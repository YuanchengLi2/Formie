import { Text, View } from "react-native";
import { HapticPressable as Pressable } from "@/components/haptic-pressable";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { ResponsiveScreen } from "@/components/responsive-screen";
import { ProductionMotion } from "@/components/production-motion";
import { ProductionIcon } from "@/components/production-icon";
import { RECORDING_CHECKS } from "@/features/capture/recording-checks";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";
import { usePhoneLayoutProfile } from "@/theme/responsive";

export function RecordingTipsScreen({ onContinue, onOpenSpaceHelp }: { onContinue: () => void; onOpenSpaceHelp: () => void }) {
  const layout = usePhoneLayoutProfile();
  return (
    <ResponsiveScreen testID="recording-tips-responsive-screen" contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.lg }}>
      <Animated.View entering={FadeInDown.duration(220)}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Set up your camera.</Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(50).duration(240)} layout={LinearTransition.duration(180)} testID="recording-tips-motion-card" style={{ height: layout.short ? 180 : 232, overflow: "hidden", borderRadius: radii.md, borderCurve: "continuous", backgroundColor: colors.surfaceRaised }}><ProductionMotion kind="cameraSetup" accessibilityLabel="Animated phone placement guide" style={{ width: "100%", height: "100%" }} /></Animated.View>
      <View style={{ gap: 0 }}>{RECORDING_CHECKS.map((item, index) => <Animated.View entering={FadeInDown.delay(90 + index * 45).duration(220)} key={item} layout={LinearTransition.duration(180)} testID={`recording-tip-row-${index}`} style={{ minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderColor: colors.border }}><Text selectable style={[typography.label, { width: 20, color: colors.gold, fontVariant: ["tabular-nums"] }]}>{index + 1}</Text><ProductionIcon name="stageCheck" label="Complete" size={22} tintColor={colors.gold} /><Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{item}</Text></Animated.View>)}</View>
      <Animated.View entering={FadeInDown.delay(280).duration(220)}><Pressable accessibilityRole="button" onPress={onOpenSpaceHelp} style={{ alignItems: "center", paddingVertical: spacing.sm }}><Text selectable style={[typography.label, { color: colors.gold }]}>No good place for your phone?</Text></Pressable></Animated.View>
      <Animated.View entering={FadeInDown.delay(320).duration(220)} style={{ gap: spacing.sm }}><FormButton label="Continue to Camera" onPress={onContinue} /></Animated.View>
    </ResponsiveScreen>
  );
}
