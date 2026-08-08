import { Text, View } from "react-native";

import { formatAnalysisFraction } from "@/features/access/account-access";
import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";

type AnalysisQuotaBarProps = {
  remaining: number | null;
  limit: number | null;
  status: "ready" | "checking" | "expired" | "purchase";
  variant?: "meter" | "badge";
};

export function AnalysisQuotaBar({ remaining, limit, status, variant = "meter" }: AnalysisQuotaBarProps) {
  const safeLimit = Number.isInteger(limit) && Number(limit) > 0 ? Number(limit) : 10;
  const safeRemaining = status === "expired" || status === "purchase"
    ? 0
    : typeof remaining === "number" && Number.isFinite(remaining)
      ? Math.max(0, Math.min(safeLimit, Math.floor(remaining)))
      : null;
  const percentage = safeRemaining === null ? 0 : (safeRemaining / safeLimit) * 100;
  const label = status === "checking"
    ? "Analysis balance is being checked"
    : status === "expired" || status === "purchase"
      ? `0 of ${safeLimit} analyses available`
      : `${safeRemaining ?? 0} of ${safeLimit} analyses remaining`;
  const fraction = formatAnalysisFraction(status === "checking" ? null : safeRemaining, safeLimit);
  const badge = variant === "badge";

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeLimit, now: safeRemaining ?? undefined }}
      testID="analysis-quota-bar"
      style={{
        width: badge ? 64 : "100%",
        flexShrink: badge ? 0 : 1,
        minHeight: badge ? 38 : 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: badge ? "center" : "flex-start",
        gap: badge ? 0 : 12,
        paddingHorizontal: badge ? 8 : 14,
        borderRadius: radii.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.gold,
        backgroundColor: colors.background,
      }}
    >
      <Text selectable style={{ color: colors.gold, fontSize: badge ? 12 : 16, lineHeight: badge ? 16 : 20, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
        {fraction}
      </Text>
      {badge ? null : <View testID="analysis-quota-track" style={{ flex: 1, minWidth: 0, height: 8, overflow: "hidden", borderRadius: radii.pill, backgroundColor: colors.surfaceRaised }}>
        <View testID="analysis-quota-fill" style={{ width: `${percentage}%`, height: "100%", borderRadius: radii.pill, backgroundColor: colors.gold }} />
      </View>}
    </View>
  );
}
