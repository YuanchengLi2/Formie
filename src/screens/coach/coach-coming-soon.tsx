import { BlurView } from "expo-blur";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { AnalysisHistoryItem } from "@/features/progress/group-sessions";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

import { RecordingPicker } from "./recording-picker";

type Props = { videos: AnalysisHistoryItem[] };

export function CoachComingSoonScreen({ videos }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="coach-coming-soon-background"
        pointerEvents="none"
        style={{ flex: 1, paddingTop: insets.top }}
      >
        <View style={{ alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text selectable style={[typography.heading, { color: colors.text, letterSpacing: 2 }]}>FORMIE COACH</Text>
        </View>
        <RecordingPicker videos={videos} creating={false} onChoose={() => undefined} />
      </View>

      <BlurView
        testID="coach-coming-soon-blur"
        pointerEvents="none"
        intensity={90}
        tint="systemMaterialDark"
        experimentalBlurMethod="dimezisBlurView"
        blurReductionFactor={3}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />

      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl }}>
        <Text selectable style={[typography.title, { color: colors.text, textAlign: "center" }]}>Under Construction</Text>
      </View>
    </View>
  );
}
