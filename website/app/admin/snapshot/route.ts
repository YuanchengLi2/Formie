import { loadRuntimeAdminDashboard } from "@/lib/admin/supabase-runtime"; import { handleAdminSnapshot } from "@/lib/admin/snapshot-handler";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return handleAdminSnapshot(request, loadRuntimeAdminDashboard); }
