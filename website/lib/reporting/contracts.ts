export type MetricQuality = "exact" | "estimated" | "incomplete" | "unavailable";
export type MetricSettlement = "not_applicable" | "estimated" | "final" | "allocated";
export type Metric = { value: number | null; unit: "count" | "percent" | "money" | "milliseconds"; quality: MetricQuality; settlement: MetricSettlement; currency: string | null; numerator: number | null; denominator: number | null; observedSince: string | null; asOf: string; definition: string };
export type DashboardSection = "overview" | "revenue" | "creators" | "growth";
export type ReportingWindow = "24h" | "7d" | "30d" | "90d" | "all" | "custom";
export type BusinessDashboard = { generatedAt: string; rangeStart: string | null; rangeEnd: string; section: DashboardSection; window: ReportingWindow; metrics: Record<string, Metric>; trends: Record<string, string | number | null>[]; creators: Record<string, unknown>[]; growth: Record<string, unknown[]>; alerts: { key: string; severity: "warning" | "error"; message: string }[] };

const qualities = new Set<MetricQuality>(["exact", "estimated", "incomplete", "unavailable"]);
const settlements = new Set<MetricSettlement>(["not_applicable", "estimated", "final", "allocated"]);
const units = new Set<Metric["unit"]>(["count", "percent", "money", "milliseconds"]);
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Reporting response is invalid"); return value as Record<string, unknown>; }
export function parseMetric(value: unknown): Metric {
  const row = record(value); const quality = String(row.quality) as MetricQuality; const settlement = String(row.settlement) as MetricSettlement; const unit = String(row.unit) as Metric["unit"];
  if (!qualities.has(quality) || !settlements.has(settlement) || !units.has(unit) || typeof row.definition !== "string" || typeof row.asOf !== "string") throw new Error("Reporting metric is invalid");
  if (!Number.isFinite(Date.parse(row.asOf)) || (row.observedSince != null && (typeof row.observedSince !== "string" || !Number.isFinite(Date.parse(row.observedSince))))) throw new Error("Reporting metric timestamp is invalid");
  const numeric = (key: string) => {
    if (row[key] === null || row[key] === undefined) return null;
    const parsed = Number(row[key]);
    if (!Number.isFinite(parsed)) throw new Error(`Reporting metric ${key} is invalid`);
    return parsed;
  };
  if (unit === "money" && (typeof row.currency !== "string" || !/^[A-Z]{3}$/.test(row.currency))) throw new Error("Reporting metric currency is invalid");
  return { value: numeric("value"), unit, quality, settlement, currency: typeof row.currency === "string" ? row.currency : null, numerator: numeric("numerator"), denominator: numeric("denominator"), observedSince: typeof row.observedSince === "string" ? row.observedSince : null, asOf: row.asOf, definition: row.definition };
}
export function parseBusinessDashboard(value: unknown): BusinessDashboard {
  const row = record(value); const section = row.section as DashboardSection; const window = row.window as ReportingWindow;
  if (!["overview","revenue","creators","growth"].includes(section) || !["24h","7d","30d","90d","all","custom"].includes(window) || typeof row.generatedAt !== "string" || typeof row.rangeEnd !== "string") throw new Error("Reporting response is invalid");
  const trends = Array.isArray(row.trends)
    ? row.trends.map((value) => Object.fromEntries(Object.entries(record(value)).map(([key, item]) => {
      if (item !== null && typeof item !== "string" && typeof item !== "number") throw new Error(`Reporting trend ${key} is invalid`);
      return [key, item];
    })))
    : [];
  const growth = Object.fromEntries(Object.entries(record(row.growth)).map(([key,items]) => { if (!Array.isArray(items)) throw new Error(`Reporting growth ${key} is invalid`); return [key,items]; })) as Record<string,unknown[]>;
  const alerts: BusinessDashboard["alerts"] = Array.isArray(row.alerts) ? row.alerts.map((value): BusinessDashboard["alerts"][number] => { const alert=record(value);const severity=alert.severity;if(typeof alert.key!=="string"||typeof alert.message!=="string"||(severity!=="warning"&&severity!=="error"))throw new Error("Reporting alert is invalid");return {key:alert.key,severity,message:alert.message}; }) : [];
  return { generatedAt: row.generatedAt, rangeStart: typeof row.rangeStart === "string" ? row.rangeStart : null, rangeEnd: row.rangeEnd, section, window, metrics: Object.fromEntries(Object.entries(record(row.metrics)).map(([key,value]) => [key,parseMetric(value)])), trends, creators: Array.isArray(row.creators) ? row.creators.map(record) : [], growth, alerts };
}
