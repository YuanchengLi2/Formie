import type { DashboardFilters } from "./dashboard-filters";
export type MetricQuality = "exact" | "estimated" | "incomplete" | "unavailable";
export type MetricValue<T> = { value: T | null; quality: MetricQuality; numerator: number | null; denominator: number | null; observedSince: string | null; detail: string; scope?: "filtered" | "global" };
export type HeadlineMetrics = {
  newSignups: MetricValue<number>; firstRecordingDeliveryRate: MetricValue<number>; medianSignupToFirstAnalysisMs: MetricValue<number>; analysesPerActiveUser: MetricValue<number>; sameSessionSecondAnalysisRate: MetricValue<number>; sevenDayRepeatRate: MetricValue<number>; thirtyDayRetentionRate: MetricValue<number>; helpfulRate: MetricValue<number>; freeToPaidConversionRate: MetricValue<number>; aiCostPerDeliveredAnalysis: MetricValue<number>; estimatedMrr: MetricValue<number>;
};
export type FunnelStep = { key: string; label: string; users: MetricValue<number>; conversion: MetricValue<number>; medianTransitionMs: MetricValue<number> };
export type BreakdownRow = { key: string; label: string; metrics: Record<string, MetricValue<number>> };
export type RecentUser = { id: string; email: string; displayName: string | null; joinedAt: string; plan: string; analyses: number; lastActiveAt: string | null; source: string | null; status: string };
export type RecentAnalysis = { id: string; userEmail: string; exercise: string; status: string; createdAt: string; processingMs: number | null; aiCost: number | null; aiCostComplete: boolean; feedback: boolean | null };
export type AdminDashboardSnapshot = {
  generatedAt: string; filters: DashboardFilters & { exerciseLabel: string | null; exerciseOptions: Array<{ id: number; label: string }> };
  headline: HeadlineMetrics; cohorts: { northStar: MetricValue<number>; habit14d: MetricValue<number>; retention30d: MetricValue<number> };
  activity: Record<string, MetricValue<number>>; funnel: FunnelStep[];
  breakdowns: { helpfulness: BreakdownRow[]; loop: BreakdownRow[] };
  operations: { reliability: Record<string, MetricValue<number>>; billing: Record<string, MetricValue<number>>; economics: Record<string, MetricValue<number>> };
  recentUsers: RecentUser[]; recentAnalyses: RecentAnalysis[];
};
const headlineKeys: Array<keyof HeadlineMetrics> = ["newSignups","firstRecordingDeliveryRate","medianSignupToFirstAnalysisMs","analysesPerActiveUser","sameSessionSecondAnalysisRate","sevenDayRepeatRate","thirtyDayRetentionRate","helpfulRate","freeToPaidConversionRate","aiCostPerDeliveredAnalysis","estimatedMrr"];
function object(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`); return value as Record<string, unknown>; }
function finite(value: unknown, label: string, nullable = false): number | null { if (nullable && value === null) return null; if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${label}`); return value; }
function metric(value: unknown, label: string): MetricValue<number> {
  const row = object(value, label); const quality = row.quality; if (!(["exact","estimated","incomplete","unavailable"] as unknown[]).includes(quality)) throw new Error(`Invalid ${label}.quality`);
  const numerator = finite(row.numerator, `${label}.numerator`, true); const denominator = finite(row.denominator, `${label}.denominator`, true); const result = finite(row.value, `${label}.value`, true);
  if (numerator !== null && denominator !== null && (numerator < 0 || denominator < 0 || numerator > denominator)) throw new Error(`Contradictory ${label}`);
  if (typeof row.detail !== "string" || (row.observedSince !== null && (typeof row.observedSince !== "string" || Number.isNaN(Date.parse(row.observedSince))))) throw new Error(`Invalid ${label} metadata`);
  if (row.scope !== undefined && row.scope !== "filtered" && row.scope !== "global") throw new Error(`Invalid ${label}.scope`);
  return { value: result, quality: quality as MetricQuality, numerator, denominator, observedSince: row.observedSince as string | null, detail: row.detail, ...(row.scope ? { scope: row.scope as "filtered" | "global" } : {}) };
}
function metricRecord(value: unknown, label: string): Record<string, MetricValue<number>> { const row = object(value, label); return Object.fromEntries(Object.entries(row).map(([key, item]) => [key, metric(item, `${label}.${key}`)])); }
function breakdown(value: unknown, label: string): BreakdownRow[] { if (!Array.isArray(value)) throw new Error(`Invalid ${label}`); return value.map((item, index) => { const row = object(item, `${label}[${index}]`); if (typeof row.key !== "string" || typeof row.label !== "string") throw new Error(`Invalid ${label}[${index}]`); return { key: row.key, label: row.label, metrics: metricRecord(row.metrics, `${label}[${index}].metrics`) }; }); }
export function parseDashboardSnapshot(input: unknown): AdminDashboardSnapshot {
  const root = object(input, "dashboard snapshot"); if (typeof root.generatedAt !== "string" || Number.isNaN(Date.parse(root.generatedAt))) throw new Error("Invalid generatedAt");
  const rawFilters = object(root.filters, "filters"); const window = rawFilters.window; if (!["24h","7d","30d","90d","all"].includes(String(window))) throw new Error("Invalid filters.window");
  const exerciseId = rawFilters.exerciseId === null ? null : finite(rawFilters.exerciseId, "filters.exerciseId"); if (exerciseId !== null && (!Number.isInteger(exerciseId) || exerciseId <= 0)) throw new Error("Invalid filters.exerciseId");
  if (!Array.isArray(rawFilters.exerciseOptions)) throw new Error("Invalid exercise options");
  const headlineRaw = object(root.headline, "headline"); const headline = {} as HeadlineMetrics; for (const key of headlineKeys) headline[key] = metric(headlineRaw[key], `headline.${key}`);
  const rawCohorts = object(root.cohorts, "cohorts"); const rawFunnel = root.funnel; if (!Array.isArray(rawFunnel)) throw new Error("Invalid funnel");
  const funnel = rawFunnel.map((item, index) => { const row = object(item, `funnel[${index}]`); if (typeof row.key !== "string" || typeof row.label !== "string") throw new Error(`Invalid funnel[${index}]`); return { key: row.key, label: row.label, users: metric(row.users, `funnel[${index}].users`), conversion: metric(row.conversion, `funnel[${index}].conversion`), medianTransitionMs: metric(row.medianTransitionMs, `funnel[${index}].medianTransitionMs`) }; });
  const rawBreakdowns = object(root.breakdowns, "breakdowns"); const rawOperations = object(root.operations, "operations");
  return { generatedAt: root.generatedAt, filters: { window: window as DashboardFilters["window"], exerciseId: exerciseId as number | null, exerciseLabel: rawFilters.exerciseLabel === null ? null : String(rawFilters.exerciseLabel), exerciseOptions: rawFilters.exerciseOptions.map((item, index) => { const row = object(item, `exerciseOptions[${index}]`); const id = finite(row.id, "exercise id") as number; if (!Number.isInteger(id) || id <= 0 || typeof row.label !== "string") throw new Error("Invalid exercise option"); return { id, label: row.label }; }) }, headline, cohorts: { northStar: metric(rawCohorts.northStar, "cohorts.northStar"), habit14d: metric(rawCohorts.habit14d, "cohorts.habit14d"), retention30d: metric(rawCohorts.retention30d, "cohorts.retention30d") }, activity: metricRecord(root.activity, "activity"), funnel, breakdowns: { helpfulness: breakdown(rawBreakdowns.helpfulness, "breakdowns.helpfulness"), loop: breakdown(rawBreakdowns.loop, "breakdowns.loop") }, operations: { reliability: metricRecord(object(rawOperations.reliability, "operations.reliability"), "operations.reliability"), billing: metricRecord(object(rawOperations.billing, "operations.billing"), "operations.billing"), economics: metricRecord(object(rawOperations.economics, "operations.economics"), "operations.economics") }, recentUsers: Array.isArray(root.recentUsers) ? root.recentUsers as RecentUser[] : (() => { throw new Error("Invalid recentUsers"); })(), recentAnalyses: Array.isArray(root.recentAnalyses) ? root.recentAnalyses as RecentAnalysis[] : (() => { throw new Error("Invalid recentAnalyses"); })() };
}
