import { Text, View } from "react-native";

import { RecordingCheckIcon, type RecordingCheckIconName } from "@/components/recording-check-icon";
import { RECORDING_CHECK_DETAILS, RECORDING_CHECKS } from "@/features/capture/recording-checks";
import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";
import { typography } from "@/theme/type";

const icons: readonly RecordingCheckIconName[] = ["distance", "body", "movement", "stable", "blocked", "samePosition"];

export function RecordingChecklist() {
  return (
    <View testID="recording-review-checklist" style={{ overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: "#2B2B2B", backgroundColor: "#111111", paddingHorizontal: 14, paddingVertical: 5 }}>
      {RECORDING_CHECKS.map((label, index) => (
        <View key={label} testID={`recording-review-check-row-${index}`} style={{ width: "100%", minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: index < RECORDING_CHECKS.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
          <View testID={`recording-review-check-icon-${index}`} style={{ width: 40, height: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 11, borderCurve: "continuous", borderWidth: 1, borderColor: "#3C3322", backgroundColor: "#262117" }}>
            <RecordingCheckIcon name={icons[index]!} size={24} color={colors.gold} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={[typography.label, { color: colors.text, fontSize: 14, lineHeight: 19 }]}>{label.replace(/\.$/, "")}</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary, fontSize: 12, lineHeight: 17 }]}>{RECORDING_CHECK_DETAILS[index]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
