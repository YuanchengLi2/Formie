import { redirect } from "next/navigation";

import { FounderOverview } from "@/components/admin/founder-overview";
import { BusinessDashboardShell } from "@/components/admin/business-dashboard-shell";
import { AdminAccessError } from "@/lib/admin/load-dashboard";
import { loadBusinessDashboard } from "@/lib/admin/load-business-dashboard";
import { parseDashboardRange, type DashboardSearchParams } from "@/lib/reporting/filters";

export const dynamic = "force-dynamic";

export default async function FounderDashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  let data;
  try {
    const range = parseDashboardRange(await searchParams);
    data = await loadBusinessDashboard("overview",range.window,range.start,range.end);
  } catch (error) {
    if (error instanceof AdminAccessError) redirect("/admin/login");
    throw error;
  }
  return <BusinessDashboardShell dashboard={data.dashboard} adminEmail={data.adminEmail}><FounderOverview dashboard={data.dashboard}/></BusinessDashboardShell>;
}
