import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { FormButton } from "@/components/form-button";
import { FormCard } from "@/components/form-card";
import { PhonePlacementIllustration } from "@/components/phone-placement-illustration";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type RecordingTipsScreenProps = {
  onContinue: () => void;
  onOpenSpaceHelp: () => void;
};

const PLACEMENTS = ["On a bench", "Against a water bottle or gym bag", "On a small phone tripod"];
const CHECKLIST = [
  "Use the rear camera for better quality",
  "Use 0.5x if space is limited",
  "Aim for roughly hip-to-chest height",
  "Use a side or diagonal view when possible",
  "Keep the full movement visible",
  "Record several complete repetitions",
];

export function RecordingTipsScreen({ onContinue, onOpenSpaceHelp }: RecordingTipsScreenProps) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxxl }}
    >
      <Animated.View entering={FadeInDown.duration(220)} style={{ gap: spacing.sm }}>
        <Text selectable style={[typography.title, { color: colors.text }]}>Place your phone anywhere stable</Text>
        <Text selectable style={[typography.body, { color: colors.textSecondary }]}>A useful view matters more than a perfect camera angle.</Text>
      </Animated.View>

      <PhonePlacementIllustration />

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {PLACEMENTS.map((placement) => (
          <View
            key={placement}
            style={{
              flex: 1,
              minHeight: 92,
              justifyContent: "flex-end",
              padding: spacing.md,
              borderRadius: radii.md,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <View style={{ width: 20, height: 30, marginBottom: spacing.sm, borderRadius: 5, borderWidth: 1, borderColor: colors.gold }} />
            <Text selectable style={[typography.caption, { color: colors.text }]}>{placement}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.md }}>
        {CHECKLIST.map((item) => (
          <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: colors.gold }}>
              <Text selectable style={{ color: colors.gold, fontSize: 12 }}>✓</Text>
            </View>
            <Text selectable style={[typography.body, { flex: 1, color: colors.text }]}>{item}</Text>
          </View>
        ))}
      </View>

      <FormCard style={{ backgroundColor: colors.goldSoft, borderColor: colors.gold }}>
        <Text selectable style={[typography.label, { color: colors.gold }]}>The angle does not need to be perfect. Just keep yourself and the movement visible.</Text>
      </FormCard>

      <View style={{ gap: spacing.sm }}>
        <FormButton label="Continue to Camera" onPress={onContinue} />
        <Pressable accessibilityRole="button" onPress={onOpenSpaceHelp} style={{ alignItems: "center", paddingVertical: spacing.md }}>
          <Text selectable style={[typography.label, { color: colors.gold }]}>No good place for your phone?</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
