import type { ReportingWindow } from "./contracts";

export type DashboardSearchParams = { window?: string; start?: string; end?: string };

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function parseDashboardRange(params: DashboardSearchParams): { window: ReportingWindow; start: string | null; end: string | null } {
  if (params.window === "custom" && params.start && params.end && isoDate.test(params.start) && isoDate.test(params.end)) {
    const startTime = Date.parse(`${params.start}T00:00:00Z`);
    const endTime = Date.parse(`${params.end}T00:00:00Z`);
    if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime >= startTime && endTime - startTime <= 366 * 86_400_000) {
      return { window: "custom", start: params.start, end: params.end };
    }
  }
  const window = params.window === "24h" || params.window === "7d" || params.window === "90d" || params.window === "all" ? params.window : "30d";
  return { window, start: null, end: null };
}
