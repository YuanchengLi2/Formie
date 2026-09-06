import type { Metric } from "@/lib/reporting/contracts";

function format(metric: Metric): string {
  if (metric.value === null) return "Unavailable";
  if (metric.unit === "money") return new Intl.NumberFormat("en-US", { style: "currency", currency: metric.currency ?? "USD", maximumFractionDigits: 2 }).format(metric.value);
  if (metric.unit === "percent") return `${metric.value.toFixed(1)}%`;
  if (metric.unit === "milliseconds") return `${Math.round(metric.value / 100) / 10}s`;
  return new Intl.NumberFormat("en-US", { notation: Math.abs(metric.value) >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(metric.value);
}
export function MetricCard({ label, metric }: { label: string; metric: Metric | undefined }) {
  if (!metric) return null;
  return <article className="admin-metric"><div className="admin-metric-label"><span>{label}</span><em data-quality={metric.quality}>{metric.quality}</em></div><strong>{format(metric)}</strong><small>{metric.definition}{metric.observedSince ? ` · observed since ${new Date(metric.observedSince).toLocaleDateString()}` : ""}</small></article>;
}
