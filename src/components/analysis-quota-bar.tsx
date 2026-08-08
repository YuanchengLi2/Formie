import { Text, View } from "react-native";

import { formatAnalysisFraction } from "@/features/access/account-access";
import { colors } from "@/theme/colors";
import { radii } from "@/theme/spacing";

type AnalysisQuotaBarProps = {
  remaining: number | null;
  limit: number | null;
  status: "ready" | "checking" | "expired" | "purchase";
  compact?: boolean;
};

export function AnalysisQuotaBar({ remaining, limit, status, compact = false }: AnalysisQuotaBarProps) {
  const safeLimit = Number.isInteger(limit) && Number(limit) > 0 ? Number(limit) : 10;
  const safeRemaining = status === "expired" || status === "purchase" ? 0 : typeof remaining === "number" && Number.isFinite(remaining) ? Math.max(0, Math.min(safeLimit, Math.floor(remaining))) : null;
  const percentage = safeRemaining === null ? 0 : (safeRemaining / safeLimit) * 100;
  const label = status === "checking"
    ? "Analysis balance is being checked"
    : status === "purchase"
      ? "Purchase a subscription to use the app"
      : status === "expired"
        ? `Subscription required. 0 of ${safeLimit} analyses available`
      : `${safeRemaining ?? 0} of ${safeLimit} analyses remaining`;

  if (status === "purchase") {
    return (
      <View
        accessibilityLabel={label}
        accessibilityRole="progressbar"
        style={{
          minHeight: compact ? 44 : 48,
          minWidth: compact ? 160 : 280,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: compact ? 10 : 14,
          borderRadius: radii.pill,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.gold,
          backgroundColor: colors.background,
        }}
      >
        <Text selectable numberOfLines={compact ? 3 : 1} style={{ flex: 1, color: colors.gold, fontSize: compact ? 11 : 14, lineHeight: compact ? 14 : 18, fontWeight: "800", textAlign: "center" }}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeLimit, now: safeRemaining ?? undefined }}
      testID="analysis-quota-bar"
      style={{
        minHeight: compact ? 38 : 48,
        minWidth: compact ? 128 : 220,
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 8 : 12,
        paddingHorizontal: compact ? 10 : 14,
        borderRadius: radii.pill,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.gold,
        backgroundColor: colors.background,
      }}
    >
      <Text selectable style={{ minWidth: compact ? 34 : 44, color: colors.gold, fontSize: compact ? 12 : 16, lineHeight: compact ? 16 : 20, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
        {formatAnalysisFraction(status === "checking" ? null : safeRemaining, safeLimit)}
      </Text>
      <View testID="analysis-quota-track" style={{ flex: 1, minWidth: compact ? 72 : 112, height: compact ? 6 : 8, overflow: "hidden", borderRadius: radii.pill, backgroundColor: colors.surfaceRaised }}>
        <View testID="analysis-quota-fill" style={{ width: `${percentage}%`, height: "100%", borderRadius: radii.pill, backgroundColor: colors.gold }} />
      </View>
    </View>
  );
}
