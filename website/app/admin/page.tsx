import { redirect } from "next/navigation";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminAccessError } from "@/lib/admin/load-dashboard";
import { loadRuntimeAdminDashboard } from "@/lib/admin/supabase-runtime";

export const dynamic = "force-dynamic";

export default async function FounderDashboardPage() {
  let data;
  try {
    data = await loadRuntimeAdminDashboard();
  } catch (error) {
    if (error instanceof AdminAccessError) redirect("/admin/login");
    throw error;
  }
  return <AdminDashboard snapshot={data.snapshot} adminEmail={data.adminEmail} />;
}
