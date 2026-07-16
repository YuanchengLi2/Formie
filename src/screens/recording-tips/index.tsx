import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { PhonePlacementIllustration } from "@/components/phone-placement-illustration";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type RecordingTipsScreenProps = {
  onContinue: () => void;
  onOpenSpaceHelp: () => void;
};

const CHECKLIST = [
  "Keep the full movement visible",
  "Use a side or diagonal view",
  "Use 0.5x if space is limited",
] as const;

export function RecordingTipsScreen({ onContinue, onOpenSpaceHelp }: RecordingTipsScreenProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl }}
    >
      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Get a clear view.</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>Place your phone anywhere stable. The angle does not need to be perfect.</Text>
      </Animated.View>

      <PhonePlacementIllustration />

      <View style={{ gap: spacing.sm }}>
        {CHECKLIST.map((item) => (
          <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.gold }}>
              <Text selectable style={{ color: colors.gold, fontSize: 11 }}>✓</Text>
            </View>
            <Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{item}</Text>
          </View>
        ))}
      </View>

      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>Use the rear camera for better quality. On a bench, against a water bottle or gym bag, or on a small phone tripod all work.</Text>

      <Pressable accessibilityRole="button" onPress={onOpenSpaceHelp} style={{ alignItems: "center", paddingVertical: spacing.sm }}>
        <Text selectable style={[typography.label, { color: colors.gold }]}>ⓘ  No good place for your phone?</Text>
      </Pressable>

      <View style={{ gap: spacing.sm }}>
        <FormButton label="Continue to Camera" onPress={onContinue} />
        <Text selectable style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>▣  By continuing, you consent to private video upload for AI form analysis.</Text>
      </View>
    </ScrollView>
  );
}
