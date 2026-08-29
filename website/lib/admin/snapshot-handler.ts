import { AdminAccessError } from "./load-dashboard"; import { parseDashboardFilters } from "./dashboard-filters"; import type { AdminDashboardSnapshot } from "./dashboard-data";
export async function handleAdminSnapshot(request: Request, load: (filters: ReturnType<typeof parseDashboardFilters>) => Promise<{ snapshot: AdminDashboardSnapshot }>): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  let filters; try { filters = parseDashboardFilters(new URL(request.url).searchParams); } catch { return new Response(JSON.stringify({ code: "INVALID_FILTERS" }), { status: 400, headers }); }
  try { const { snapshot } = await load(filters); return new Response(JSON.stringify(snapshot), { status: 200, headers }); } catch (error) { if (error instanceof AdminAccessError) return new Response(JSON.stringify({ code: "UNAUTHORIZED" }), { status: 401, headers }); return new Response(JSON.stringify({ code: "REPORTING_UNAVAILABLE" }), { status: 503, headers }); }
}
