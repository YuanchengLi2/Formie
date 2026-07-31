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
};

function MetricTile({
  kind,
  label,
  value,
  compact,
  loading,
}: {
  kind: "streak" | "average" | "best" | "improvement";
  label: string;
  value: string;
  compact: boolean;
  loading: boolean;
}) {
  const spokenValue = loading ? "Loading" : value;
  const iconName: DashboardIconName = kind;
  return (
    <View
      accessibilityLabel={`${label}: ${spokenValue}`}
      testID={`progress-metric-${kind}`}
      style={{
        width: compact ? 176 : "48.5%",
        minHeight: compact ? 104 : 112,
        justifyContent: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: "rgba(25,25,25,0.72)",
        opacity: loading ? 0.5 : 1,
      }}
    >
      <DashboardIcon label={`${label} icon`} name={iconName} size={32} />
      <Text selectable style={[typography.caption, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text selectable numberOfLines={1} style={[typography.label, { color: colors.text }]}>
        {loading ? "Loading…" : value}
      </Text>
    </View>
  );
}

export function ProgressMetricsPanel({ layout, metrics, loading = false }: ProgressMetricsPanelProps) {
  const tiles = progressMetricDefinitions.map(({ kind, label }) => (
    <MetricTile
      compact={layout === "horizontal"}
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
