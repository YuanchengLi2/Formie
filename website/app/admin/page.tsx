import { redirect } from "next/navigation";

import { LiveAdminDashboard } from "@/components/admin/live-admin-dashboard";
import { AdminAccessError } from "@/lib/admin/load-dashboard";
import { loadRuntimeAdminDashboard } from "@/lib/admin/supabase-runtime";

export const dynamic = "force-dynamic";

export default async function FounderDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let data;
  try {
    const { parseDashboardFilters } = await import("@/lib/admin/dashboard-filters");
    data = await loadRuntimeAdminDashboard(parseDashboardFilters(await searchParams));
  } catch (error) {
    if (error instanceof AdminAccessError) redirect("/admin/login");
    throw error;
  }
  return <LiveAdminDashboard initialSnapshot={data.snapshot} adminEmail={data.adminEmail} />;
}
