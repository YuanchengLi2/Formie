import { isAdminEmail } from "./access";
import { createCookieClient, createServiceClient } from "./supabase-runtime";
import { AdminAccessError } from "./load-dashboard";
import { parseBusinessDashboard, type BusinessDashboard, type DashboardSection, type ReportingWindow } from "../reporting/contracts";

export async function loadBusinessDashboard(section: DashboardSection, window: ReportingWindow, start: string | null = null, end: string | null = null): Promise<{ adminEmail: string; dashboard: BusinessDashboard }> {
  const auth = await createCookieClient();
  const { data: authData, error: authError } = await auth.auth.getUser();
  const email = authError ? null : authData.user?.email ?? null;
  if (!isAdminEmail(email, process.env.FORMIE_ADMIN_EMAIL)) throw new AdminAccessError();
  const { data, error } = await createServiceClient().rpc("get_founder_business_dashboard_v10", { p_section: section, p_window: window, p_start: start, p_end: end });
  if (error) throw new Error(`Business reporting query failed: ${error.message}`);
  return { adminEmail: email!, dashboard: parseBusinessDashboard(data) };
}

export async function loadFounderCreatorDetail(creatorId: string, page = 1): Promise<Record<string, unknown> | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creatorId)) return null;
  const auth = await createCookieClient();
  const { data: authData, error: authError } = await auth.auth.getUser();
  const email = authError ? null : authData.user?.email ?? null;
  if (!isAdminEmail(email, process.env.FORMIE_ADMIN_EMAIL)) throw new AdminAccessError();
  const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, 2_001) : 1;
  const { data, error } = await createServiceClient().rpc("get_founder_creator_detail_v2", { p_creator_id: creatorId, p_window: "all", p_limit: 50, p_offset: (safePage - 1) * 50 });
  if (error) throw new Error(`Creator detail query failed: ${error.message}`);
  return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
}
