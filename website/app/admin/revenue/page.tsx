import { redirect } from "next/navigation";
import { BusinessDashboardShell } from "@/components/admin/business-dashboard-shell";
import { RevenueDashboard } from "@/components/admin/revenue-dashboard";
import { loadBusinessDashboard } from "@/lib/admin/load-business-dashboard";
import { AdminAccessError } from "@/lib/admin/load-dashboard";
import { parseDashboardRange, type DashboardSearchParams } from "@/lib/reporting/filters";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<DashboardSearchParams>}){let data;try{const range=parseDashboardRange(await searchParams);data=await loadBusinessDashboard("revenue",range.window,range.start,range.end)}catch(error){if(error instanceof AdminAccessError)redirect("/admin/login");throw error}return <BusinessDashboardShell dashboard={data.dashboard} adminEmail={data.adminEmail}><RevenueDashboard dashboard={data.dashboard}/></BusinessDashboardShell>}
