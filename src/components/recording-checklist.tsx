import { Text, View } from "react-native";

import { RecordingCheckIcon, type RecordingCheckIconName } from "@/components/recording-check-icon";
import { CaptureReferenceIcon } from "@/components/capture-reference-icon";
import { RECORDING_CHECK_DETAILS, RECORDING_CHECKS } from "@/features/capture/recording-checks";
import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";
import { typography } from "@/theme/type";

const icons: readonly RecordingCheckIconName[] = ["distance", "body", "movement", "stable", "blocked", "samePosition"];

export function RecordingChecklist() {
  return (
    <View testID="recording-review-checklist" style={{ overflow: "hidden", borderRadius: radii.lg, borderCurve: "continuous", borderWidth: 1, borderColor: "#2B2B2B", backgroundColor: "#111111", paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 36, alignItems: "center", justifyContent: "center" }}>
          <CaptureReferenceIcon name="shieldCheck" size={28} color={colors.gold} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={[typography.heading, { color: colors.text, fontSize: 20, lineHeight: 24 }]}>6 things to check</Text>
          <Text selectable style={[typography.body, { color: colors.textSecondary, fontSize: 13, lineHeight: 18 }]}>Make sure your recording meets all of these for the best analysis.</Text>
        </View>
      </View>
      {RECORDING_CHECKS.map((label, index) => (
        <View key={label} testID={`recording-review-check-row-${index}`} style={{ width: "100%", minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderBottomWidth: index < RECORDING_CHECKS.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
          <View style={{ width: 40, alignItems: "center", justifyContent: "center" }}>
            <RecordingCheckIcon name={icons[index]!} size={36} color={colors.text} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text selectable style={[typography.label, { color: colors.text, fontSize: 14, lineHeight: 18 }]}>{label.replace(/\.$/, "")}</Text>
            <Text selectable style={[typography.body, { color: colors.textSecondary, fontSize: 12, lineHeight: 17 }]}>{RECORDING_CHECK_DETAILS[index]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
