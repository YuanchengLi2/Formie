import { ScrollView, Text, View } from "react-native";

import { DashboardIcon, type DashboardIconName } from "@/components/dashboard-icon";
import {
  progressMetricDefinitions,
  progressMetricsValue,
  type ProgressMetrics,
} from "@/features/progress/metrics";
import { colors } from "@/theme/colors";
import { radii, spacing } from "@/theme/spacing";
import { typography } from "@/theme/type";

type ProgressMetricsPanelProps = {
  layout: "grid" | "horizontal";
  metrics: ProgressMetrics | null;
  loading?: boolean;
  emptyState?: boolean;
};

function MetricTile({
  kind,
  label,
  value,
  compact,
  emptyState,
  loading,
}: {
  kind: "streak" | "average" | "best" | "improvement";
  label: string;
  value: string;
  compact: boolean;
  emptyState: boolean;
  loading: boolean;
}) {
  const spokenValue = loading ? "Loading" : value;
  const iconName: DashboardIconName = kind;
  const compactEmpty = compact && emptyState;
  return (
    <View
      accessibilityLabel={`${label}: ${spokenValue}`}
      testID={`progress-metric-${kind}`}
      style={{
        width: compactEmpty ? 196 : compact ? 176 : "48.5%",
        height: compactEmpty ? 54 : undefined,
        minHeight: compactEmpty ? 54 : compact ? 72 : 112,
        justifyContent: "center",
        gap: compactEmpty ? 0 : compact ? 2 : spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: compactEmpty ? 2 : compact ? spacing.xs : spacing.sm,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: "rgba(25,25,25,0.72)",
        opacity: loading ? 0.5 : 1,
      }}
    >
      <DashboardIcon label={`${label} icon`} name={iconName} size={compactEmpty ? 20 : compact ? 26 : 32} />
      <Text selectable style={[typography.caption, { color: colors.textMuted }, compactEmpty && { fontSize: 10, lineHeight: 12 }]}>
        {label}
      </Text>
      <Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }, compactEmpty && { fontSize: 12, lineHeight: 14 }]}>
        {loading ? "Loading…" : value}
      </Text>
    </View>
  );
}

export function ProgressMetricsPanel({ layout, metrics, loading = false, emptyState = false }: ProgressMetricsPanelProps) {
  const tiles = progressMetricDefinitions.map(({ kind, label }) => (
    <MetricTile
      compact={layout === "horizontal"}
      emptyState={emptyState}
      key={kind}
      kind={kind}
      label={label}
      loading={loading}
      value={progressMetricsValue(metrics, kind)}
    />
  ));

  if (layout === "horizontal") {
    return (
      <ScrollView
        horizontal
        testID="progress-metrics-horizontal"
        accessibilityLabel="Progress rewards"
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {tiles}
      </ScrollView>
    );
  }

  return (
    <View
      testID="progress-metrics-grid"
      accessibilityLabel="Progress rewards"
      style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
    >
      {tiles}
    </View>
  );
}
